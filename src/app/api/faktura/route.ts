import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { invoices, invoiceLines } from "@/lib/db/schemas";
import { eq, desc, and, count } from "drizzle-orm";
import { VAT_RATE, VMB_FACTOR } from "@/lib/constants";

export async function GET(request: NextRequest) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const type       = searchParams.get("type");
  const status     = searchParams.get("status");
  const customerId = searchParams.get("customer_id");
  const page   = Math.max(1, parseInt(searchParams.get("page")  ?? "1"));
  const limit  = Math.min(100, parseInt(searchParams.get("limit") ?? "20"));

  const conditions: any[] = [];
  if (type)       conditions.push(eq(invoices.type,       type as any));
  if (status)     conditions.push(eq(invoices.status,     status as any));
  if (customerId) conditions.push(eq(invoices.customerId, customerId));

  const data = await db
    .select({
      id:            invoices.id,
      invoiceNumber: invoices.invoiceNumber,
      type:          invoices.type,
      status:        invoices.status,
      customerId:    invoices.customerId,
      totalIncVat:   invoices.totalIncVat,
      invoiceDate:   invoices.invoiceDate,
      dueDate:       invoices.dueDate,
      createdAt:     invoices.createdAt,
    })
    .from(invoices)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(invoices.createdAt))
    .limit(limit)
    .offset((page - 1) * limit);

  return NextResponse.json({ data, page, limit }, {
    headers: { "Cache-Control": "private, max-age=0, stale-while-revalidate=30" },
  });
}

export async function POST(request: NextRequest) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  if (!body.customerId) {
    return NextResponse.json({ error: "customerId krävs" }, { status: 400 });
  }

  const { lines: bodyLines, ...invoiceData } = body;

  try {
    // Calculate totals from lines
    let subtotalExVat = 0;
    let vatAmount = 0;
    let vmbVatAmount = 0;

    const parsedLines = (Array.isArray(bodyLines) ? bodyLines : []).map((line: any, i: number) => {
      const qty = parseFloat(line.quantity) || 0;
      const price = parseFloat(line.unitPrice) || 0;
      const discPct = parseFloat(line.discountPct) || 0;
      const lineTotal = qty * price * (1 - discPct / 100);
      subtotalExVat += lineTotal;

      if (line.vmbEligible) {
        const cost = parseFloat(line.costBasis) || 0;
        const effectivePrice = price * (1 - discPct / 100);
        const margin = effectivePrice - cost;
        if (margin > 0) vmbVatAmount += margin * qty * VMB_FACTOR;
      } else {
        vatAmount += lineTotal * VAT_RATE;
      }

      return {
        sortOrder: line.sortOrder ?? i,
        lineType: line.lineType ?? "labor",
        description: line.description ?? "",
        quantity: qty.toString(),
        unit: line.unit ?? "st",
        unitPrice: price.toString(),
        discountPct: discPct.toString(),
        vmbEligible: line.vmbEligible ?? false,
        costBasis: line.costBasis ? line.costBasis.toString() : null,
        partId: line.partId ?? null,
        workOrderTaskId: line.workOrderTaskId ?? null,
      };
    });

    const totalIncVat = subtotalExVat + vatAmount + vmbVatAmount;
    const paymentTermsDays = parseInt(invoiceData.paymentTermsDays) || 30;

    const now = new Date();
    const invoiceDate = now.toISOString().split("T")[0];
    const dueDate = new Date(now.getTime() + paymentTermsDays * 86400000).toISOString().split("T")[0];

    // Use transaction to ensure atomic invoice number generation + insert
    const invoice = await db.transaction(async (tx) => {
      const [countRow] = await tx
        .select({ total: count(invoices.id) })
        .from(invoices);
      const seq = (countRow?.total ?? 0) + 1;
      const invoiceNumber = invoiceData.type === "quote"
        ? `OFF-${String(seq).padStart(4, "0")}`
        : `FAK-${String(seq).padStart(4, "0")}`;

      const [inv] = await tx
        .insert(invoices)
        .values({
          type: invoiceData.type ?? "invoice",
          status: "draft",
          invoiceNumber,
          customerId: invoiceData.customerId,
          workOrderId: invoiceData.workOrderId ?? null,
          paymentTermsDays,
          invoiceDate,
          dueDate,
          subtotalExVat: subtotalExVat.toFixed(4),
          vatAmount: vatAmount.toFixed(4),
          vmbVatAmount: vmbVatAmount.toFixed(4),
          totalIncVat: totalIncVat.toFixed(4),
          notes: invoiceData.notes ?? null,
          createdBy: user.id,
        })
        .returning();

      if (parsedLines.length > 0) {
        await tx.insert(invoiceLines).values(
          parsedLines.map((l) => ({ ...l, invoiceId: inv.id })),
        );
      }

      return inv;
    });

    return NextResponse.json({ data: invoice }, { status: 201 });
  } catch (err: any) {
    console.error("[faktura] POST error:", err);
    return NextResponse.json(
      { error: err.message ?? "Kunde inte skapa faktura." },
      { status: 500 },
    );
  }
}
