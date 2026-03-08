import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { vehicles } from "@/lib/db/schemas";
import { eq, and } from "drizzle-orm";
import { getPortalCustomer } from "@/lib/portal/auth";

export async function GET(request: Request) {
  const customer = await getPortalCustomer(request);
  if (!customer) return NextResponse.json({ error: "Ej behörig" }, { status: 401 });

  const data = await db.select().from(vehicles).where(and(eq(vehicles.customerId, customer.customerId), eq(vehicles.isActive, true)));

  return NextResponse.json(data.map(v => ({
    id: v.id, registration_number: v.regNr, make: v.brand, model: v.model,
    year: v.modelYear, vin: v.vin, mileage: v.mileageKm,
  })));
}
