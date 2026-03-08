import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { invoices, invoiceLines } from "@/lib/db/schemas";
import { eq, and, asc } from "drizzle-orm";
import { getPortalCustomer } from "@/lib/portal/auth";

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const customer = await getPortalCustomer(request);
  if (!customer) return NextResponse.json({ error: "Ej behörig" }, { status: 401 });

  const [invoice] = await db.select().from(invoices).where(and(eq(invoices.id, params.id), eq(invoices.customerId, customer.customerId)));
  if (!invoice) return NextResponse.json({ error: "Faktura hittades inte" }, { status: 404 });

  const lines = await db.select().from(invoiceLines).where(eq(invoiceLines.invoiceId, invoice.id)).orderBy(asc(invoiceLines.sortOrder));

  const mapStatus = (s: string) => s === "paid" ? "paid" : "unpaid";

  return NextResponse.json({
    id: invoice.id, invoice_number: invoice.invoiceNumber,
    date: invoice.invoiceDate, due_date: invoice.dueDate,
    status: mapStatus(invoice.status),
    total: Number(invoice.totalIncVat), vat: Number(invoice.vatAmount),
    rows: lines.map(l => ({
      description: l.description, quantity: Number(l.quantity),
      unit_price: Number(l.unitPrice), total: Number(l.lineTotal),
    })),
    swish_qr: null, // TODO: implement Swish QR generation
  });
}
