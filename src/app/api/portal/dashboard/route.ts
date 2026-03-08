import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { vehicles, workOrders, invoices, crmReminders } from "@/lib/db/schemas";
import { eq, and, ne, or, count, desc, asc, sql, inArray } from "drizzle-orm";
import { getPortalCustomer } from "@/lib/portal/auth";

export async function GET(request: Request) {
  const customer = await getPortalCustomer(request);
  if (!customer) return NextResponse.json({ error: "Ej behörig" }, { status: 401 });

  const cid = customer.customerId;

  const [vehiclesCount] = await db.select({ count: count() }).from(vehicles).where(and(eq(vehicles.customerId, cid), eq(vehicles.isActive, true)));

  const [activeOrders] = await db.select({ count: count() }).from(workOrders).where(and(eq(workOrders.customerId, cid), ne(workOrders.status, "finished"), ne(workOrders.status, "cancelled")));

  const [unpaidInvoices] = await db.select({ count: count() }).from(invoices).where(and(eq(invoices.customerId, cid), eq(invoices.type, "invoice"), or(eq(invoices.status, "sent"), eq(invoices.status, "overdue"))));

  const [upcomingReminders] = await db.select({ count: count() }).from(crmReminders).where(and(eq(crmReminders.customerId, cid), eq(crmReminders.status, "sent")));

  const recentOrders = await db.select().from(workOrders).where(eq(workOrders.customerId, cid)).orderBy(desc(workOrders.receivedAt)).limit(5);

  // Map work order status to portal-friendly format
  const mapOrderStatus = (s: string) => {
    const map: Record<string, string> = {
      queued: "received", diagnosing: "in_progress", ongoing: "in_progress",
      ordering_parts: "in_progress", waiting_for_parts: "in_progress",
      ready_for_pickup: "completed", finished: "delivered", cancelled: "delivered",
    };
    return map[s] || s;
  };

  // Batch-fetch vehicles for recent orders (avoid N+1 queries)
  const vehicleIds = Array.from(new Set(recentOrders.map((o) => o.vehicleId).filter(Boolean))) as string[];
  const vehicleList = vehicleIds.length > 0
    ? await db.select().from(vehicles).where(inArray(vehicles.id, vehicleIds))
    : [];
  const vehicleMap = new Map(vehicleList.map((v) => [v.id, v]));

  const recentWithVehicles = recentOrders.map((o) => {
    const v = o.vehicleId ? vehicleMap.get(o.vehicleId) : undefined;
    return {
      id: o.id, order_number: o.orderNumber, status: mapOrderStatus(o.status),
      created_at: o.receivedAt?.toISOString(), description: o.customerComplaint,
      vehicle: v ? { id: v.id, registration_number: v.regNr, make: v.brand, model: v.model, year: v.modelYear } : undefined,
    };
  });

  const nextReminders = await db.select().from(crmReminders).where(and(eq(crmReminders.customerId, cid), eq(crmReminders.status, "sent"))).orderBy(asc(crmReminders.dueDate)).limit(5);

  return NextResponse.json({
    vehicles_count: vehiclesCount.count,
    active_orders: activeOrders.count,
    unpaid_invoices: unpaidInvoices.count,
    upcoming_reminders: upcomingReminders.count,
    recent_orders: recentWithVehicles,
    next_reminders: nextReminders.map(r => ({
      id: r.id, type: r.type, message: r.message, due_date: r.dueDate,
    })),
  });
}
