import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { invoices, invoiceLines, customers } from "@/lib/db/schemas";
import { eq, asc } from "drizzle-orm";
import {
  isFortnoxEnabled,
  getOrCreateFortnoxCustomer,
  createFortnoxInvoice,
  type LocalCustomer,
  type LocalInvoice,
  type LocalInvoiceLine,
} from "@/lib/integrations/fortnox/client";

/**
 * POST /api/faktura/[id]/fortnox
 * Syncs an invoice to Fortnox. Creates customer if needed, then creates draft invoice.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  // Auth check
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    // 1. Fetch invoice + customer
    const [invoice] = await db
      .select({
        id:                invoices.id,
        invoiceNumber:     invoices.invoiceNumber,
        invoiceDate:       invoices.invoiceDate,
        dueDate:           invoices.dueDate,
        notes:             invoices.notes,
        totalIncVat:       invoices.totalIncVat,
        fortnoxId:         invoices.fortnoxId,
        fortnoxSyncStatus: invoices.fortnoxSyncStatus,
        customerId:        customers.id,
        customerIsCompany:     customers.isCompany,
        customerFirstName:     customers.firstName,
        customerLastName:      customers.lastName,
        customerCompanyName:   customers.companyName,
        customerOrgNr:         customers.orgNr,
        customerPersonalNr:    customers.personalNr,
        customerEmail:         customers.email,
        customerPhone:         customers.phone,
        customerAddressLine1:  customers.addressLine1,
        customerAddressLine2:  customers.addressLine2,
        customerPostalCode:    customers.postalCode,
        customerCity:          customers.city,
        customerFortnoxNr:     customers.fortnoxCustomerNumber,
      })
      .from(invoices)
      .innerJoin(customers, eq(invoices.customerId, customers.id))
      .where(eq(invoices.id, params.id));

    if (!invoice) {
      return NextResponse.json({ error: "Faktura hittades inte" }, { status: 404 });
    }

    // 2. Prevent double sync
    if (invoice.fortnoxSyncStatus === "synced" && invoice.fortnoxId) {
      return NextResponse.json({
        error: `Fakturan är redan synkad till Fortnox (${invoice.fortnoxId})`,
        fortnoxId: invoice.fortnoxId,
      }, { status: 409 });
    }

    // 3. Fetch invoice lines
    const lines = await db
      .select()
      .from(invoiceLines)
      .where(eq(invoiceLines.invoiceId, params.id))
      .orderBy(asc(invoiceLines.sortOrder));

    if (lines.length === 0) {
      return NextResponse.json(
        { error: "Fakturan har inga rader att synka." },
        { status: 400 },
      );
    }

    // 4. Map to Fortnox client types
    const localCustomer: LocalCustomer = {
      id: invoice.customerId,
      isCompany: invoice.customerIsCompany,
      firstName: invoice.customerFirstName,
      lastName: invoice.customerLastName,
      companyName: invoice.customerCompanyName,
      orgNr: invoice.customerOrgNr,
      personalNr: invoice.customerPersonalNr,
      email: invoice.customerEmail,
      phone: invoice.customerPhone,
      addressLine1: invoice.customerAddressLine1,
      addressLine2: invoice.customerAddressLine2,
      postalCode: invoice.customerPostalCode,
      city: invoice.customerCity,
      fortnoxCustomerNumber: invoice.customerFortnoxNr,
    };

    const localInvoice: LocalInvoice = {
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      invoiceDate: invoice.invoiceDate,
      dueDate: invoice.dueDate,
      notes: invoice.notes,
      totalIncVat: invoice.totalIncVat,
    };

    const localLines: LocalInvoiceLine[] = lines.map((l) => ({
      lineType: l.lineType,
      description: l.description,
      quantity: l.quantity,
      unit: l.unit,
      unitPrice: l.unitPrice,
      discountPct: l.discountPct,
      vmbEligible: l.vmbEligible,
      costBasis: l.costBasis,
    }));

    // 5. Sync customer to Fortnox
    const { customerNumber, created: customerCreated } =
      await getOrCreateFortnoxCustomer(localCustomer);

    // Save Fortnox customer number back to our DB
    if (customerCreated || !invoice.customerFortnoxNr) {
      await db
        .update(customers)
        .set({ fortnoxCustomerNumber: customerNumber, updatedAt: new Date() })
        .where(eq(customers.id, invoice.customerId));
    }

    // 6. Create invoice in Fortnox
    const { documentNumber, total } = await createFortnoxInvoice(
      localInvoice,
      localLines,
      customerNumber,
    );

    // 7. Update our invoice with Fortnox data
    await db
      .update(invoices)
      .set({
        fortnoxId: documentNumber,
        fortnoxSyncStatus: "synced",
        fortnoxSyncedAt: new Date(),
        fortnoxErrorMsg: null,
        updatedAt: new Date(),
      })
      .where(eq(invoices.id, params.id));

    return NextResponse.json({
      success: true,
      fortnoxId: documentNumber,
      fortnoxTotal: total,
      customerNumber,
      customerCreated,
      mock: !isFortnoxEnabled(),
    });
  } catch (err: any) {
    console.error("[faktura/fortnox] Sync error:", err);

    // Save error state
    try {
      await db
        .update(invoices)
        .set({
          fortnoxSyncStatus: "error",
          fortnoxErrorMsg: err.message ?? "Okänt fel vid synkning",
          updatedAt: new Date(),
        })
        .where(eq(invoices.id, params.id));
    } catch (dbErr) {
      console.error("[faktura/fortnox] Failed to save error state:", dbErr);
    }

    return NextResponse.json(
      { error: err.message ?? "Kunde inte synka till Fortnox." },
      { status: 500 },
    );
  }
}
