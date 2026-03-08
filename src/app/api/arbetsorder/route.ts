import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { workOrders } from "@/lib/db/schemas";
import { eq, desc, and } from "drizzle-orm";
import { createWorkOrderSchema } from "@/lib/validations/work-order";

export async function GET(request: NextRequest) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const status     = searchParams.get("status");
  const vehicleId  = searchParams.get("vehicle_id");
  const customerId = searchParams.get("customer_id");
  const page  = Math.max(1, parseInt(searchParams.get("page")  ?? "1"));
  const limit = Math.min(100, parseInt(searchParams.get("limit") ?? "20"));

  const conditions = [];
  if (status)     conditions.push(eq(workOrders.status, status as any));
  if (vehicleId)  conditions.push(eq(workOrders.vehicleId, vehicleId));
  if (customerId) conditions.push(eq(workOrders.customerId, customerId));

  const data = await db
    .select({
      id:                workOrders.id,
      orderNumber:       workOrders.orderNumber,
      status:            workOrders.status,
      receivedAt:        workOrders.receivedAt,
      promisedAt:        workOrders.promisedAt,
      customerComplaint: workOrders.customerComplaint,
      vehicleId:         workOrders.vehicleId,
      customerId:        workOrders.customerId,
    })
    .from(workOrders)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(workOrders.receivedAt))
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
  const parsed = createWorkOrderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Valideringsfel", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  // Convert numeric fields from number to string for Drizzle numeric columns
  const insertData: Record<string, unknown> = { ...parsed.data, createdBy: user.id };
  if (typeof insertData.laborRateOverride === "number") {
    insertData.laborRateOverride = String(insertData.laborRateOverride);
  }

  const [order] = await db
    .insert(workOrders)
    .values(insertData as any)
    .returning();

  return NextResponse.json({ data: order }, { status: 201 });
}
