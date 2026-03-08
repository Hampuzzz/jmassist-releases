import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import {
  workOrders, workOrderTasks, workOrderParts,
  invoices, invoiceLines, parts,
} from "@/lib/db/schemas";
import { eq, and, asc, count } from "drizzle-orm";
import { VAT_RATE, VMB_FACTOR } from "@/lib/constants";
import { getWorkshopHourlyRate } from "@/lib/workshop-rate";

/**
 * POST /api/arbetsorder/[id]/faktura
 * Generate a draft invoice OR quote from a work order's tasks and parts.
 * Body: { type?: "invoice" | "quote" } — default "invoice"
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const workOrderId = params.id;

  // Parse type from request body (default "invoice")
  let docType: "invoice" | "quote" = "invoice";
  try {
    const body = await request.json();
    if (body?.type === "quote") docType = "quote";
  } catch {
    // No body or invalid JSON — default to invoice
  }

  const isQuote = docType === "quote";

  try {
    // 1. Fetch work order
    const [order] = await db
      .select({
        id:                workOrders.id,
        customerId:        workOrders.customerId,
        invoiceId:         workOrders.invoiceId,
        orderNumber:       workOrders.orderNumber,
        laborRateOverride: workOrders.laborRateOverride,
      })
      .from(workOrders)
      .where(eq(workOrders.id, workOrderId));

    if (!order) {
      return NextResponse.json({ error: "Arbetsorder hittades inte" }, { status: 404 });
    }

    // 2. For invoices: check if one already exists. Quotes allow multiples.
    if (!isQuote && order.invoiceId) {
      return NextResponse.json(
        { error: "Faktura finns redan", invoiceId: order.invoiceId },
        { status: 409 },
      );
    }

    // 3. Fetch tasks
    const tasks = await db
      .select({
        id:             workOrderTasks.id,
        description:    workOrderTasks.description,
        estimatedHours: workOrderTasks.estimatedHours,
        actualHours:    workOrderTasks.actualHours,
        isCompleted:    workOrderTasks.isCompleted,
      })
      .from(workOrderTasks)
      .where(eq(workOrderTasks.workOrderId, workOrderId))
      .orderBy(asc(workOrderTasks.sortOrder));

    // 4. Fetch parts used (with part names)
    const partsUsed = await db
      .select({
        id:            workOrderParts.id,
        partId:        workOrderParts.partId,
        quantity:      workOrderParts.quantity,
        unitCostPrice: workOrderParts.unitCostPrice,
        unitSellPrice: workOrderParts.unitSellPrice,
        vmbEligible:   workOrderParts.vmbEligible,
        costBasis:     workOrderParts.costBasis,
        partName:      parts.name,
        partNumber:    parts.partNumber,
      })
      .from(workOrderParts)
      .innerJoin(parts, eq(workOrderParts.partId, parts.id))
      .where(eq(workOrderParts.workOrderId, workOrderId));

    // 5. Build invoice lines
    const workshopRate = await getWorkshopHourlyRate();
    const hourlyRate = order.laborRateOverride
      ? parseFloat(order.laborRateOverride)
      : workshopRate;

    let subtotalExVat = 0;
    let vatAmount = 0;
    let vmbVatAmount = 0;
    let sortIdx = 0;

    // Labor lines from tasks
    const laborLines = tasks.map((t) => {
      const hours = t.actualHours
        ? parseFloat(t.actualHours)
        : (t.estimatedHours ? parseFloat(t.estimatedHours) : 0);
      const lineTotal = hours * hourlyRate;
      subtotalExVat += lineTotal;
      vatAmount += lineTotal * VAT_RATE;

      return {
        sortOrder: sortIdx++,
        lineType: "labor" as const,
        workOrderTaskId: t.id,
        partId: null,
        description: t.description,
        quantity: hours.toString(),
        unit: "tim",
        unitPrice: hourlyRate.toString(),
        discountPct: "0",
        vmbEligible: false,
        costBasis: null,
      };
    });

    // Part lines
    const partLines = partsUsed.map((p) => {
      const qty = parseFloat(p.quantity);
      const sellPrice = parseFloat(p.unitSellPrice);
      const costPrice = parseFloat(p.unitCostPrice);
      const lineTotal = qty * sellPrice;
      subtotalExVat += lineTotal;

      if (p.vmbEligible) {
        const margin = sellPrice - costPrice;
        if (margin > 0) vmbVatAmount += margin * qty * VMB_FACTOR;
      } else {
        vatAmount += lineTotal * VAT_RATE;
      }

      return {
        sortOrder: sortIdx++,
        lineType: "part" as const,
        partId: p.partId,
        workOrderTaskId: null,
        description: `${p.partName} (${p.partNumber})`,
        quantity: qty.toString(),
        unit: "st",
        unitPrice: sellPrice.toString(),
        discountPct: "0",
        vmbEligible: p.vmbEligible,
        costBasis: p.costBasis ?? costPrice.toString(),
      };
    });

    const allLines = [...laborLines, ...partLines];

    if (allLines.length === 0) {
      return NextResponse.json(
        { error: "Arbetsorden har inga uppgifter eller delar att fakturera" },
        { status: 400 },
      );
    }

    const totalIncVat = subtotalExVat + vatAmount + vmbVatAmount;

    // 6. Generate number (separate series for quotes and invoices)
    const prefix = isQuote ? "OFF" : "FAK";
    const [countRow] = await db
      .select({ total: count(invoices.id) })
      .from(invoices)
      .where(eq(invoices.type, docType));
    const seq = (countRow?.total ?? 0) + 1;
    const invoiceNumber = `${prefix}-${String(seq).padStart(4, "0")}`;

    // 7. Calculate dates
    const now = new Date();
    const invoiceDate = now.toISOString().split("T")[0];
    const paymentTermsDays = 30;
    const dueDate = new Date(now.getTime() + paymentTermsDays * 86400000)
      .toISOString()
      .split("T")[0];

    // 8. Insert invoice/quote
    const [invoice] = await db
      .insert(invoices)
      .values({
        type: docType,
        status: "draft",
        invoiceNumber,
        customerId: order.customerId,
        workOrderId,
        paymentTermsDays: isQuote ? undefined : paymentTermsDays,
        invoiceDate,
        dueDate: isQuote ? undefined : dueDate,
        subtotalExVat: subtotalExVat.toFixed(4),
        vatAmount: vatAmount.toFixed(4),
        vmbVatAmount: vmbVatAmount.toFixed(4),
        totalIncVat: totalIncVat.toFixed(4),
        notes: `${isQuote ? "Offert" : "Faktura"} genererad från arbetsorder ${order.orderNumber}`,
        createdBy: user.id,
      })
      .returning();

    // 9. Insert invoice lines
    await db.insert(invoiceLines).values(
      allLines.map((l) => ({ ...l, invoiceId: invoice.id })),
    );

    // 10. Link invoice to work order (only for invoices, not quotes)
    if (!isQuote) {
      await db
        .update(workOrders)
        .set({ invoiceId: invoice.id, updatedAt: new Date() })
        .where(eq(workOrders.id, workOrderId));
    }

    return NextResponse.json(
      { invoiceId: invoice.id, invoiceNumber },
      { status: 201 },
    );
  } catch (err: any) {
    console.error("[arbetsorder/faktura] POST error:", err);
    return NextResponse.json(
      { error: err.message ?? "Kunde inte skapa faktura" },
      { status: 500 },
    );
  }
}
