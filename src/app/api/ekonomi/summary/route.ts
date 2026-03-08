import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { invoices, invoiceLines, expenses } from "@/lib/db/schemas";
import { and, eq, gte, lte, sql, ne } from "drizzle-orm";

export const dynamic = "force-dynamic";

/**
 * GET /api/ekonomi/summary?year=2026&month=2
 *
 * Returns aggregated financial data for the given period:
 * - revenue (omsättning exkl moms)
 * - partsCost (inköpskostnad delar)
 * - laborRevenue (arbetsinkomst)
 * - partsRevenue (delförsäljning)
 * - standardVat (25% moms på arbete/avgifter)
 * - vmbVat (VMB-moms på delar)
 * - totalVatToPay (total momsskuld)
 * - totalExpenses (utgifter exkl moms)
 * - expenseVatDeductible (avdragsgill moms på inköp)
 * - grossProfit (bruttovinst)
 * - netProfit (nettovinst efter fasta utgifter)
 * - expensesByCategory (per kategori)
 * - breakEvenTarget (hur mycket omsättning som krävs)
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const year = parseInt(url.searchParams.get("year") ?? String(new Date().getFullYear()));
  const monthParam = url.searchParams.get("month");

  // Build date range
  let startDate: string;
  let endDate: string;

  if (monthParam) {
    const month = parseInt(monthParam);
    startDate = `${year}-${String(month).padStart(2, "0")}-01`;
    // Last day of month
    const lastDay = new Date(year, month, 0).getDate();
    endDate = `${year}-${String(month).padStart(2, "0")}-${lastDay}`;
  } else {
    startDate = `${year}-01-01`;
    endDate = `${year}-12-31`;
  }

  try {
    // ── 1. Invoice-level totals (only sent/paid invoices) ──
    const [invoiceTotals] = await db
      .select({
        totalRevenue: sql<string>`COALESCE(SUM(${invoices.subtotalExVat}::numeric), 0)`,
        totalStandardVat: sql<string>`COALESCE(SUM(${invoices.vatAmount}::numeric), 0)`,
        totalVmbVat: sql<string>`COALESCE(SUM(${invoices.vmbVatAmount}::numeric), 0)`,
        totalIncVat: sql<string>`COALESCE(SUM(${invoices.totalIncVat}::numeric), 0)`,
        invoiceCount: sql<number>`COUNT(*)::int`,
      })
      .from(invoices)
      .where(
        and(
          gte(invoices.invoiceDate, startDate),
          lte(invoices.invoiceDate, endDate),
          ne(invoices.status, "draft"),
          ne(invoices.status, "cancelled"),
          eq(invoices.type, "invoice"),
        ),
      );

    // ── 2. Invoice lines breakdown (labor vs parts cost) ──
    const [lineBreakdown] = await db
      .select({
        laborRevenue: sql<string>`COALESCE(SUM(
          CASE WHEN ${invoiceLines.lineType} = 'labor'
          THEN (${invoiceLines.quantity}::numeric * ${invoiceLines.unitPrice}::numeric * (1 - ${invoiceLines.discountPct}::numeric / 100))
          ELSE 0 END
        ), 0)`,
        partsRevenue: sql<string>`COALESCE(SUM(
          CASE WHEN ${invoiceLines.lineType} = 'part'
          THEN (${invoiceLines.quantity}::numeric * ${invoiceLines.unitPrice}::numeric * (1 - ${invoiceLines.discountPct}::numeric / 100))
          ELSE 0 END
        ), 0)`,
        partsCost: sql<string>`COALESCE(SUM(
          CASE WHEN ${invoiceLines.lineType} = 'part' AND ${invoiceLines.costBasis} IS NOT NULL
          THEN (${invoiceLines.quantity}::numeric * ${invoiceLines.costBasis}::numeric)
          ELSE 0 END
        ), 0)`,
        feeRevenue: sql<string>`COALESCE(SUM(
          CASE WHEN ${invoiceLines.lineType} IN ('fee', 'discount')
          THEN (${invoiceLines.quantity}::numeric * ${invoiceLines.unitPrice}::numeric * (1 - ${invoiceLines.discountPct}::numeric / 100))
          ELSE 0 END
        ), 0)`,
      })
      .from(invoiceLines)
      .innerJoin(invoices, eq(invoiceLines.invoiceId, invoices.id))
      .where(
        and(
          gte(invoices.invoiceDate, startDate),
          lte(invoices.invoiceDate, endDate),
          ne(invoices.status, "draft"),
          ne(invoices.status, "cancelled"),
          eq(invoices.type, "invoice"),
        ),
      );

    // ── 3. Expenses (fasta kostnader) ──
    const expenseRows = await db
      .select({
        category: expenses.category,
        totalAmount: sql<string>`COALESCE(SUM(${expenses.amount}::numeric), 0)`,
        totalVat: sql<string>`COALESCE(SUM(
          CASE WHEN ${expenses.vatDeductible} THEN ${expenses.vatAmount}::numeric ELSE 0 END
        ), 0)`,
        count: sql<number>`COUNT(*)::int`,
      })
      .from(expenses)
      .where(
        and(
          gte(expenses.date, startDate),
          lte(expenses.date, endDate),
        ),
      )
      .groupBy(expenses.category);

    // ── Aggregate ──
    const revenue = parseFloat(invoiceTotals?.totalRevenue ?? "0");
    const standardVat = parseFloat(invoiceTotals?.totalStandardVat ?? "0");
    const vmbVat = parseFloat(invoiceTotals?.totalVmbVat ?? "0");
    const invoiceCount = invoiceTotals?.invoiceCount ?? 0;

    const laborRevenue = parseFloat(lineBreakdown?.laborRevenue ?? "0");
    const partsRevenue = parseFloat(lineBreakdown?.partsRevenue ?? "0");
    const partsCost = parseFloat(lineBreakdown?.partsCost ?? "0");
    const feeRevenue = parseFloat(lineBreakdown?.feeRevenue ?? "0");

    const totalExpenses = expenseRows.reduce(
      (sum, r) => sum + parseFloat(r.totalAmount), 0,
    );
    const expenseVatDeductible = expenseRows.reduce(
      (sum, r) => sum + parseFloat(r.totalVat), 0,
    );

    const expensesByCategory = expenseRows.map((r) => ({
      category: r.category,
      amount: parseFloat(r.totalAmount),
      vat: parseFloat(r.totalVat),
      count: r.count,
    }));

    // ── Calculations ──
    // Bruttovinst = Omsättning - Inköpskostnad delar
    const grossProfit = revenue - partsCost;

    // Moms att betala = utgående moms (standard + VMB) - ingående moms (avdragsgill)
    const vatToPay = standardVat + vmbVat - expenseVatDeductible;

    // Nettovinst = Bruttovinst - fasta utgifter
    const netProfit = grossProfit - totalExpenses;

    // Break-even = Fasta kostnader / (1 - (partsCost / revenue))
    // = How much revenue needed to cover fixed costs given current margin
    const marginRatio = revenue > 0 ? (revenue - partsCost) / revenue : 0.6;
    const breakEvenRevenue = marginRatio > 0 ? totalExpenses / marginRatio : 0;

    return Response.json({
      period: { year, month: monthParam ? parseInt(monthParam) : null, startDate, endDate },
      revenue,
      laborRevenue,
      partsRevenue,
      feeRevenue,
      partsCost,
      grossProfit,
      standardVat,
      vmbVat,
      vatToPay,
      expenseVatDeductible,
      totalExpenses,
      netProfit,
      invoiceCount,
      breakEvenRevenue,
      revenueProgress: breakEvenRevenue > 0 ? Math.min(revenue / breakEvenRevenue, 2) : 1,
      expensesByCategory,
    });
  } catch (err) {
    console.error("[ekonomi/summary] Failed:", err);
    return Response.json(
      { error: "Kunde inte hämta ekonomidata" },
      { status: 500 },
    );
  }
}
