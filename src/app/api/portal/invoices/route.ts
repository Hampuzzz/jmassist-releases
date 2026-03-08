import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { invoices } from "@/lib/db/schemas";
import { eq, and, desc } from "drizzle-orm";
import { getPortalCustomer } from "@/lib/portal/auth";

const mapStatus = (s: string) => {
  if (s === "paid") return "paid";
  return "unpaid";
};

export async function GET(request: Request) {
  const customer = await getPortalCustomer(request);
  if (!customer) return NextResponse.json({ error: "Ej behörig" }, { status: 401 });

  const data = await db.select().from(invoices).where(and(eq(invoices.customerId, customer.customerId), eq(invoices.type, "invoice"))).orderBy(desc(invoices.invoiceDate));

  return NextResponse.json(data.map(inv => ({
    id: inv.id, invoice_number: inv.invoiceNumber, date: inv.invoiceDate,
    due_date: inv.dueDate, status: mapStatus(inv.status),
    total: Number(inv.totalIncVat), vat: Number(inv.vatAmount),
  })));
}
