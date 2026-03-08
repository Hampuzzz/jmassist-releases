import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { workOrders, vehicles } from "@/lib/db/schemas";
import { eq, desc } from "drizzle-orm";
import { getPortalCustomer } from "@/lib/portal/auth";

const mapStatus = (s: string) => {
  const map: Record<string, string> = {
    queued: "received", diagnosing: "in_progress", ongoing: "in_progress",
    ordering_parts: "in_progress", waiting_for_parts: "in_progress",
    ready_for_pickup: "completed", finished: "delivered", cancelled: "delivered",
  };
  return map[s] || s;
};

export async function GET(request: Request) {
  const customer = await getPortalCustomer(request);
  if (!customer) return NextResponse.json({ error: "Ej behörig" }, { status: 401 });

  const orders = await db.select().from(workOrders).where(eq(workOrders.customerId, customer.customerId)).orderBy(desc(workOrders.receivedAt));

  const result = await Promise.all(orders.map(async (o) => {
    const [v] = await db.select().from(vehicles).where(eq(vehicles.id, o.vehicleId));
    return {
      id: o.id, order_number: o.orderNumber, status: mapStatus(o.status),
      created_at: o.receivedAt?.toISOString(), updated_at: o.updatedAt?.toISOString(),
      description: o.customerComplaint,
      vehicle: v ? { id: v.id, registration_number: v.regNr, make: v.brand, model: v.model, year: v.modelYear } : undefined,
    };
  }));

  return NextResponse.json(result);
}
