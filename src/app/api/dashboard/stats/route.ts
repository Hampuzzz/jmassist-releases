import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import {
  workOrderTasks, workOrders, userProfiles,
  invoices, invoiceLines, parts, stockMovements,
  timeEntries,
} from "@/lib/db/schemas";
import { eq, and, or, gte, lte, ne, sql } from "drizzle-orm";
import { getWorkshopHourlyRate } from "@/lib/workshop-rate";
import { getCached, setCache } from "@/lib/cache/server-cache";

export const dynamic = "force-dynamic";

/**
 * GET /api/dashboard/stats
 * Returns smart dashboard metrics: efficiency, inventory aging, monthly result.
 */
export async function GET() {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Check cache first (60 second TTL)
  const CACHE_KEY = "dashboard-stats";
  const cached = getCached<object>(CACHE_KEY);
  if (cached) {
    return NextResponse.json(cached);
  }

  // Date ranges
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const monthEnd = `${year}-${String(month).padStart(2, "0")}-${lastDay}`;

  // Previous month
  const prevDate = new Date(year, month - 2, 1);
  const prevYear = prevDate.getFullYear();
  const prevMonth = prevDate.getMonth() + 1;
  const prevMonthStart = `${prevYear}-${String(prevMonth).padStart(2, "0")}-01`;
  const prevLastDay = new Date(prevYear, prevMonth, 0).getDate();
  const prevMonthEnd = `${prevYear}-${String(prevMonth).padStart(2, "0")}-${prevLastDay}`;

  try {
    const [
      // A: Efficiency
      totalHoursResult,
      totalLaborRevenueResult,
      mechanicHoursResult,
      mechanicRevenueResult,
      clockedHoursResult,
      // B: Inventory
      inventorySummaryResult,
      agedPartsResult,
      // C: Monthly result
      currentRevenueResult,
      prevRevenueResult,
      partsCostResult,
    ] = await Promise.all([
      // A1: Total billed hours this month
      db.select({
        totalHours: sql<string>`COALESCE(SUM(${workOrderTasks.actualHours}::numeric), 0)`,
      })
        .from(workOrderTasks)
        .where(
          and(
            eq(workOrderTasks.isCompleted, true),
            gte(workOrderTasks.completedAt, new Date(monthStart)),
            lte(workOrderTasks.completedAt, new Date(`${monthEnd}T23:59:59`)),
          ),
        ),

      // A2: Total labor revenue this month
      db.select({
        laborRevenue: sql<string>`COALESCE(SUM(
          CASE WHEN ${invoiceLines.lineType} = 'labor'
          THEN (${invoiceLines.quantity}::numeric * ${invoiceLines.unitPrice}::numeric * (1 - COALESCE(${invoiceLines.discountPct}::numeric, 0) / 100))
          ELSE 0 END
        ), 0)`,
      })
        .from(invoiceLines)
        .innerJoin(invoices, eq(invoiceLines.invoiceId, invoices.id))
        .where(
          and(
            gte(invoices.invoiceDate, monthStart),
            lte(invoices.invoiceDate, monthEnd),
            ne(invoices.status, "draft"),
            ne(invoices.status, "cancelled"),
            eq(invoices.type, "invoice"),
          ),
        ),

      // A3: Per-mechanic hours
      db.select({
        id: userProfiles.id,
        name: userProfiles.fullName,
        hoursWorked: sql<string>`COALESCE(SUM(${workOrderTasks.actualHours}::numeric), 0)`,
      })
        .from(workOrderTasks)
        .innerJoin(userProfiles, eq(workOrderTasks.assignedTo, userProfiles.id))
        .where(
          and(
            eq(workOrderTasks.isCompleted, true),
            gte(workOrderTasks.completedAt, new Date(monthStart)),
            lte(workOrderTasks.completedAt, new Date(`${monthEnd}T23:59:59`)),
            or(eq(userProfiles.role, "mechanic"), eq(userProfiles.role, "allround")),
            eq(userProfiles.isActive, true),
          ),
        )
        .groupBy(userProfiles.id, userProfiles.fullName),

      // A4: Per-mechanic labor revenue (via invoiceLines -> workOrderTasks -> userProfiles)
      db.select({
        mechanicId: workOrderTasks.assignedTo,
        laborRevenue: sql<string>`COALESCE(SUM(
          ${invoiceLines.quantity}::numeric * ${invoiceLines.unitPrice}::numeric * (1 - COALESCE(${invoiceLines.discountPct}::numeric, 0) / 100)
        ), 0)`,
      })
        .from(invoiceLines)
        .innerJoin(invoices, eq(invoiceLines.invoiceId, invoices.id))
        .innerJoin(workOrderTasks, eq(invoiceLines.workOrderTaskId, workOrderTasks.id))
        .where(
          and(
            eq(invoiceLines.lineType, "labor"),
            gte(invoices.invoiceDate, monthStart),
            lte(invoices.invoiceDate, monthEnd),
            ne(invoices.status, "draft"),
            ne(invoices.status, "cancelled"),
            eq(invoices.type, "invoice"),
          ),
        )
        .groupBy(workOrderTasks.assignedTo),

      // A5: Clocked hours (from time_entries, stopped this month)
      db.select({
        clockedHours: sql<string>`COALESCE(SUM(
          EXTRACT(EPOCH FROM (${timeEntries.stoppedAt} - ${timeEntries.startedAt})) / 3600.0
          - ${timeEntries.totalPausedSeconds}::numeric / 3600.0
        ), 0)`,
      })
        .from(timeEntries)
        .where(
          and(
            sql`${timeEntries.stoppedAt} IS NOT NULL`,
            gte(timeEntries.stoppedAt, new Date(monthStart)),
            lte(timeEntries.stoppedAt, new Date(`${monthEnd}T23:59:59`)),
          ),
        ),

      // B1: Inventory summary
      db.select({
        totalValue: sql<string>`COALESCE(SUM(${parts.stockQty}::numeric * ${parts.costPrice}::numeric), 0)`,
        lowStockCount: sql<number>`COUNT(*) FILTER (
          WHERE ${parts.stockQty}::numeric > 0
          AND ${parts.stockMinQty}::numeric > 0
          AND ${parts.stockQty}::numeric <= ${parts.stockMinQty}::numeric
        )::int`,
      })
        .from(parts)
        .where(
          and(
            eq(parts.isActive, true),
            sql`${parts.stockQty}::numeric > 0`,
          ),
        ),

      // B2: Aged inventory (last movement > 90 days ago or no movements)
      db.execute(sql`
        SELECT
          p.id,
          p.name,
          p.part_number AS "partNumber",
          (p.stock_qty::numeric * p.cost_price::numeric) AS value,
          COALESCE(EXTRACT(DAY FROM NOW() - latest.last_movement)::int, 9999) AS "daysSinceLastMovement"
        FROM parts p
        LEFT JOIN (
          SELECT part_id, MAX(created_at) AS last_movement
          FROM stock_movements
          GROUP BY part_id
        ) latest ON latest.part_id = p.id
        WHERE p.is_active = true
          AND p.stock_qty::numeric > 0
          AND (latest.last_movement IS NULL OR latest.last_movement < NOW() - INTERVAL '90 days')
        ORDER BY (p.stock_qty::numeric * p.cost_price::numeric) DESC
      `),

      // C1: Current month revenue
      db.select({
        revenue: sql<string>`COALESCE(SUM(${invoices.subtotalExVat}::numeric), 0)`,
      })
        .from(invoices)
        .where(
          and(
            gte(invoices.invoiceDate, monthStart),
            lte(invoices.invoiceDate, monthEnd),
            ne(invoices.status, "draft"),
            ne(invoices.status, "cancelled"),
            eq(invoices.type, "invoice"),
          ),
        ),

      // C2: Previous month revenue
      db.select({
        revenue: sql<string>`COALESCE(SUM(${invoices.subtotalExVat}::numeric), 0)`,
      })
        .from(invoices)
        .where(
          and(
            gte(invoices.invoiceDate, prevMonthStart),
            lte(invoices.invoiceDate, prevMonthEnd),
            ne(invoices.status, "draft"),
            ne(invoices.status, "cancelled"),
            eq(invoices.type, "invoice"),
          ),
        ),

      // C3: Parts cost this month
      db.select({
        partsCost: sql<string>`COALESCE(SUM(
          CASE WHEN ${invoiceLines.lineType} = 'part' AND ${invoiceLines.costBasis} IS NOT NULL
          THEN (${invoiceLines.quantity}::numeric * ${invoiceLines.costBasis}::numeric)
          ELSE 0 END
        ), 0)`,
      })
        .from(invoiceLines)
        .innerJoin(invoices, eq(invoiceLines.invoiceId, invoices.id))
        .where(
          and(
            gte(invoices.invoiceDate, monthStart),
            lte(invoices.invoiceDate, monthEnd),
            ne(invoices.status, "draft"),
            ne(invoices.status, "cancelled"),
            eq(invoices.type, "invoice"),
          ),
        ),
    ]);

    // Parse efficiency
    const totalBilledHours = parseFloat(totalHoursResult[0]?.totalHours ?? "0");
    const totalClockedHours = parseFloat(clockedHoursResult[0]?.clockedHours ?? "0");
    const totalLaborRevenue = parseFloat(totalLaborRevenueResult[0]?.laborRevenue ?? "0");
    const effectiveRate = totalBilledHours > 0 ? totalLaborRevenue / totalBilledHours : 0;

    // Build mechanic revenue lookup
    const mechRevenueMap = new Map<string, number>();
    for (const row of mechanicRevenueResult) {
      if (row.mechanicId) {
        mechRevenueMap.set(row.mechanicId, parseFloat(row.laborRevenue));
      }
    }

    const mechanics = mechanicHoursResult.map((m) => {
      const hours = parseFloat(m.hoursWorked);
      const rev = mechRevenueMap.get(m.id) ?? 0;
      return {
        id: m.id,
        name: m.name,
        hoursWorked: hours,
        laborRevenue: rev,
        effectiveRate: hours > 0 ? rev / hours : 0,
      };
    });

    // Parse inventory
    const totalValue = parseFloat(inventorySummaryResult[0]?.totalValue ?? "0");
    const lowStockCount = inventorySummaryResult[0]?.lowStockCount ?? 0;

    const agedRows = (agedPartsResult as unknown as {
      id: string; name: string; partNumber: string; value: string; daysSinceLastMovement: number;
    }[]);

    const agedValue = agedRows.reduce((sum, r) => sum + parseFloat(String(r.value)), 0);
    const agedPartCount = agedRows.length;
    const slowestParts = agedRows.slice(0, 5).map((r) => ({
      id: r.id,
      name: r.name,
      partNumber: r.partNumber,
      value: parseFloat(String(r.value)),
      daysSinceLastMovement: r.daysSinceLastMovement,
    }));

    // Parse monthly result
    const revenue = parseFloat(currentRevenueResult[0]?.revenue ?? "0");
    const prevMonthRevenue = parseFloat(prevRevenueResult[0]?.revenue ?? "0");
    const partsCost = parseFloat(partsCostResult[0]?.partsCost ?? "0");

    const revenueDiff = revenue - prevMonthRevenue;
    const revenueTrend: "up" | "down" | "flat" =
      revenueDiff > 100 ? "up" : revenueDiff < -100 ? "down" : "flat";

    const grossMarginPct = revenue > 0 ? ((revenue - partsCost) / revenue) * 100 : 0;

    const result = {
      efficiency: {
        totalBilledHours,
        totalClockedHours,
        totalLaborRevenue,
        effectiveRate,
        targetRate: await getWorkshopHourlyRate(),
        mechanics,
      },
      inventory: {
        totalValue,
        agedValue,
        agedPartCount,
        slowestParts,
        lowStockCount,
      },
      monthlyResult: {
        revenue,
        prevMonthRevenue,
        revenueTrend,
        grossMarginPct,
        partsCost,
      },
    };

    // Cache for 60 seconds
    setCache(CACHE_KEY, result, 60_000);

    return NextResponse.json(result);
  } catch (err: any) {
    console.error("[dashboard/stats] Failed:", err);
    return NextResponse.json(
      { error: err.message ?? "Kunde inte hämta dashboard-data" },
      { status: 500 },
    );
  }
}
