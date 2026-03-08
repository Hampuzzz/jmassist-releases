import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { customers } from "@/lib/db/schemas";
import { eq } from "drizzle-orm";
import { getPortalCustomer, getCustomerName } from "@/lib/portal/auth";

export async function GET(request: Request) {
  const customer = await getPortalCustomer(request);
  if (!customer) return NextResponse.json({ error: "Ej behörig" }, { status: 401 });

  const [c] = await db.select().from(customers).where(eq(customers.id, customer.customerId));
  if (!c) return NextResponse.json({ error: "Kund hittades inte" }, { status: 404 });

  return NextResponse.json({
    id: c.id,
    name: getCustomerName(c),
    email: c.email,
    phone: c.phone,
    address: [c.addressLine1, c.addressLine2, c.postalCode, c.city].filter(Boolean).join(", "),
    company: c.companyName,
    org_number: c.orgNr,
  });
}
