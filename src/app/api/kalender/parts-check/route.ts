import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import {
  appointments, workOrders, workOrderParts, parts,
  vehicles, customers,
} from "@/lib/db/schemas";
import { and, gte, lte, ne, eq, asc, lt } from "drizzle-orm";

/**
 * GET /api/kalender/parts-check?start=...&end=...
 * Returns appointments that have work orders with parts where stock is insufficient.
 */
export async function GET(request: NextRequest) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const start = searchParams.get("start");
  const end = searchParams.get("end");

  if (!start || !end) {
    return NextResponse.json({ error: "start and end required" }, { status: 400 });
  }

  try {
    // Find appointments in range that have linked work orders
    const appts = await db
      .select({
        appointmentId:     appointments.id,
        workOrderId:       appointments.workOrderId,
        scheduledStart:    appointments.scheduledStart,
        vehicleRegNr:      vehicles.regNr,
      })
      .from(appointments)
      .innerJoin(vehicles, eq(appointments.vehicleId, vehicles.id))
      .where(
        and(
          ne(appointments.status, "cancelled"),
          gte(appointments.scheduledStart, new Date(start)),
          lte(appointments.scheduledStart, new Date(end)),
        ),
      )
      .orderBy(asc(appointments.scheduledStart));

    // Filter to those with work orders
    const withWorkOrders = appts.filter((a) => a.workOrderId);
    if (withWorkOrders.length === 0) {
      return NextResponse.json({ data: [] });
    }

    // For each work order, check parts stock
    const results: Array<{
      appointmentId: string;
      workOrderId: string;
      scheduledStart: string;
      vehicleRegNr: string;
      missingParts: Array<{
        partId: string;
        partName: string;
        partNumber: string;
        needed: number;
        inStock: number;
        shortfall: number;
      }>;
    }> = [];

    for (const appt of withWorkOrders) {
      // Fetch parts needed for this work order
      const woParts = await db
        .select({
          partId:        workOrderParts.partId,
          quantity:      workOrderParts.quantity,
          partName:      parts.name,
          partNumber:    parts.partNumber,
          stockQty:      parts.stockQty,
        })
        .from(workOrderParts)
        .innerJoin(parts, eq(workOrderParts.partId, parts.id))
        .where(eq(workOrderParts.workOrderId, appt.workOrderId!));

      const missingParts = woParts
        .filter((p) => {
          const needed = parseFloat(p.quantity);
          const inStock = parseFloat(p.stockQty);
          return needed > inStock;
        })
        .map((p) => {
          const needed = parseFloat(p.quantity);
          const inStock = parseFloat(p.stockQty);
          return {
            partId: p.partId,
            partName: p.partName,
            partNumber: p.partNumber,
            needed,
            inStock,
            shortfall: needed - inStock,
          };
        });

      if (missingParts.length > 0) {
        results.push({
          appointmentId: appt.appointmentId,
          workOrderId: appt.workOrderId!,
          scheduledStart: appt.scheduledStart instanceof Date
            ? appt.scheduledStart.toISOString()
            : String(appt.scheduledStart),
          vehicleRegNr: appt.vehicleRegNr,
          missingParts,
        });
      }
    }

    return NextResponse.json({ data: results });
  } catch (err: any) {
    console.error("[parts-check] Error:", err);
    return NextResponse.json(
      { error: err.message ?? "Kunde inte kontrollera delar." },
      { status: 500 },
    );
  }
}
