import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { workOrders, workOrderTasks, workOrderParts, vehicles, vehicleHealthChecks, vhcItems, parts } from "@/lib/db/schemas";
import { eq, and, inArray } from "drizzle-orm";
import { getPortalCustomer } from "@/lib/portal/auth";

const mapStatus = (s: string) => {
  const map: Record<string, string> = {
    queued: "received", diagnosing: "in_progress", ongoing: "in_progress",
    ordering_parts: "in_progress", waiting_for_parts: "in_progress",
    ready_for_pickup: "completed", finished: "delivered", cancelled: "delivered",
  };
  return map[s] || s;
};

export async function GET(request: Request, { params }: { params: { id: string } }) {
  const customer = await getPortalCustomer(request);
  if (!customer) return NextResponse.json({ error: "Ej behörig" }, { status: 401 });

  const [order] = await db.select().from(workOrders).where(and(eq(workOrders.id, params.id), eq(workOrders.customerId, customer.customerId)));
  if (!order) return NextResponse.json({ error: "Order hittades inte" }, { status: 404 });

  const [vehicle] = await db.select().from(vehicles).where(eq(vehicles.id, order.vehicleId));
  const tasks = await db.select().from(workOrderTasks).where(eq(workOrderTasks.workOrderId, order.id));
  const orderParts = await db.select().from(workOrderParts).where(eq(workOrderParts.workOrderId, order.id));

  // Batch-fetch part names (avoid N+1 queries)
  const partIds = Array.from(new Set(orderParts.map((op) => op.partId).filter(Boolean))) as string[];
  const partsList = partIds.length > 0
    ? await db.select({ id: parts.id, name: parts.name }).from(parts).where(inArray(parts.id, partIds))
    : [];
  const partMap = new Map(partsList.map((p) => [p.id, p.name]));

  const partsWithNames = orderParts.map((op) => ({
    id: op.id,
    name: (op.partId ? partMap.get(op.partId) : undefined) || "Okänd del",
    quantity: Number(op.quantity),
    unit_price: Number(op.unitSellPrice),
  }));

  // VHC report for this work order
  const [vhc] = await db.select().from(vehicleHealthChecks).where(eq(vehicleHealthChecks.workOrderId, order.id));
  let vhcData = undefined;
  if (vhc) {
    const items = await db.select().from(vhcItems).where(eq(vhcItems.checkId, vhc.id)).orderBy(vhcItems.sortOrder);
    vhcData = {
      id: vhc.id, date: vhc.createdAt.toISOString(),
      items: items.map(item => ({ name: item.label, status: item.severity, notes: item.comment, images: item.mediaUrls || [] })),
    };
  }

  return NextResponse.json({
    id: order.id, order_number: order.orderNumber, status: mapStatus(order.status),
    created_at: order.receivedAt?.toISOString(), updated_at: order.updatedAt?.toISOString(),
    description: order.customerComplaint,
    vehicle: vehicle ? { id: vehicle.id, registration_number: vehicle.regNr, make: vehicle.brand, model: vehicle.model, year: vehicle.modelYear } : undefined,
    tasks: tasks.map(t => ({ id: t.id, description: t.description, completed: t.isCompleted })),
    parts: partsWithNames,
    media: [],
    vhc: vhcData,
  });
}
