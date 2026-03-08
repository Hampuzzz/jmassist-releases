import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { invoices, invoiceLines, customers } from "@/lib/db/schemas";
import { eq, asc } from "drizzle-orm";
import { VALID_INVOICE_TRANSITIONS, VAT_RATE, VMB_FACTOR } from "@/lib/constants";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    // Fetch invoice with customer info
    const [invoice] = await db
      .select({
        id:               invoices.id,
        invoiceNumber:    invoices.invoiceNumber,
        type:             invoices.type,
        status:           invoices.status,
        customerId:       invoices.customerId,
        workOrderId:      invoices.workOrderId,
        invoiceDate:      invoices.invoiceDate,
        dueDate:          invoices.dueDate,
        subtotalExVat:    invoices.subtotalExVat,
        vatAmount:        invoices.vatAmount,
        vmbVatAmount:     invoices.vmbVatAmount,
        totalIncVat:      invoices.totalIncVat,
        paymentTermsDays: invoices.paymentTermsDays,
        paidAt:           invoices.paidAt,
        paymentMethod:    invoices.paymentMethod,
        paymentReference: invoices.paymentReference,
        senderSnapshot:   invoices.senderSnapshot,
        notes:            invoices.notes,
        createdAt:        invoices.createdAt,
        updatedAt:        invoices.updatedAt,
        // Customer fields
        customerIsCompany:    customers.isCompany,
        customerFirstName:    customers.firstName,
        customerLastName:     customers.lastName,
        customerCompanyName:  customers.companyName,
        customerOrgNr:        customers.orgNr,
        customerPersonalNr:   customers.personalNr,
        customerEmail:        customers.email,
        customerPhone:        customers.phone,
        customerAddressLine1: customers.addressLine1,
        customerAddressLine2: customers.addressLine2,
        customerPostalCode:   customers.postalCode,
        customerCity:         customers.city,
      })
      .from(invoices)
      .innerJoin(customers, eq(invoices.customerId, customers.id))
      .where(eq(invoices.id, params.id));

    if (!invoice) {
      return NextResponse.json({ error: "Faktura hittades inte" }, { status: 404 });
    }

    // Fetch invoice lines
    const lines = await db
      .select()
      .from(invoiceLines)
      .where(eq(invoiceLines.invoiceId, params.id))
      .orderBy(asc(invoiceLines.sortOrder));

    return NextResponse.json({ data: { ...invoice, lines } });
  } catch (err: any) {
    console.error("[faktura/id] GET error:", err);
    return NextResponse.json(
      { error: err.message ?? "Kunde inte hämta faktura." },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { status: newStatus, lines: bodyLines, notes } = body;

  try {
    // Fetch current invoice
    const [current] = await db
      .select({ status: invoices.status })
      .from(invoices)
      .where(eq(invoices.id, params.id));

    if (!current) {
      return NextResponse.json({ error: "Faktura hittades inte" }, { status: 404 });
    }

    // ─── Status change ───
    if (newStatus) {
      const allowed = VALID_INVOICE_TRANSITIONS[current.status] ?? [];
      if (!allowed.includes(newStatus)) {
        return NextResponse.json(
          { error: `Ogiltig statusövergång: ${current.status} → ${newStatus}` },
          { status: 400 },
        );
      }

      const updateData: Record<string, unknown> = {
        status: newStatus,
        updatedAt: new Date(),
      };
      if (newStatus === "paid") {
        updateData.paidAt = new Date();
      }

      const [updated] = await db
        .update(invoices)
        .set(updateData)
        .where(eq(invoices.id, params.id))
        .returning();

      return NextResponse.json({ data: updated });
    }

    // ─── Update lines (replace all) ───
    if (Array.isArray(bodyLines)) {
      // Only allow editing draft invoices
      if (current.status !== "draft") {
        return NextResponse.json(
          { error: "Kan bara redigera rader på utkast-fakturor." },
          { status: 400 },
        );
      }

      // Calculate totals from new lines
      let subtotalExVat = 0;
      let vatAmount = 0;
      let vmbVatAmount = 0;

      const parsedLines = bodyLines.map((line: any, i: number) => {
        const qty = parseFloat(line.quantity) || 0;
        const price = parseFloat(line.unitPrice) || 0;
        const discPct = parseFloat(line.discountPct) || 0;
        const lineTotal = qty * price * (1 - discPct / 100);
        subtotalExVat += lineTotal;

        if (line.vmbEligible) {
          const cost = parseFloat(line.costBasis) || 0;
          const effectivePrice = price * (1 - discPct / 100); // discounted price for VMB margin
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

      // Use transaction to prevent data loss if insert fails after delete
      const updated = await db.transaction(async (tx) => {
        await tx.delete(invoiceLines).where(eq(invoiceLines.invoiceId, params.id));

        if (parsedLines.length > 0) {
          await tx.insert(invoiceLines).values(
            parsedLines.map((l) => ({ ...l, invoiceId: params.id })),
          );
        }

        const updateFields: Record<string, unknown> = {
          subtotalExVat: subtotalExVat.toFixed(4),
          vatAmount: vatAmount.toFixed(4),
          vmbVatAmount: vmbVatAmount.toFixed(4),
          totalIncVat: totalIncVat.toFixed(4),
          updatedAt: new Date(),
        };
        if (typeof notes === "string") {
          updateFields.notes = notes;
        }

        const [inv] = await tx
          .update(invoices)
          .set(updateFields)
          .where(eq(invoices.id, params.id))
          .returning();

        return inv;
      });

      return NextResponse.json({ data: updated });
    }

    // ─── Update notes only ───
    if (typeof notes === "string") {
      const [updated] = await db
        .update(invoices)
        .set({ notes, updatedAt: new Date() })
        .where(eq(invoices.id, params.id))
        .returning();
      return NextResponse.json({ data: updated });
    }

    return NextResponse.json({ error: "Inget att uppdatera" }, { status: 400 });
  } catch (err: any) {
    console.error("[faktura/id] PATCH error:", err);
    return NextResponse.json(
      { error: err.message ?? "Kunde inte uppdatera faktura." },
      { status: 500 },
    );
  }
}
