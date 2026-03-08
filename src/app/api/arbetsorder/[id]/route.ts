import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { workOrders } from "@/lib/db/schemas";
import { eq } from "drizzle-orm";
import { updateWorkOrderSchema } from "@/lib/validations/work-order";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [order] = await db
    .select()
    .from(workOrders)
    .where(eq(workOrders.id, params.id));

  if (!order) return NextResponse.json({ error: "Hittades inte" }, { status: 404 });

  return NextResponse.json({ data: order });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const parsed = updateWorkOrderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Valideringsfel", details: parsed.error.flatten() }, { status: 400 });
  }

  // Convert numeric fields from number to string for Drizzle numeric columns
  const setData: Record<string, unknown> = { ...parsed.data };
  if (typeof setData.laborRateOverride === "number") {
    setData.laborRateOverride = String(setData.laborRateOverride);
  }

  const [updated] = await db
    .update(workOrders)
    .set(setData)
    .where(eq(workOrders.id, params.id))
    .returning();

  if (!updated) return NextResponse.json({ error: "Hittades inte" }, { status: 404 });

  return NextResponse.json({ data: updated });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Hard delete — cascade handles child tables (tasks, parts, mechanics,
  // inspection_results, approval_requests, vhc, media).
  // Appointments set work_order_id to NULL.
  const [deleted] = await db
    .delete(workOrders)
    .where(eq(workOrders.id, params.id))
    .returning();

  if (!deleted) return NextResponse.json({ error: "Hittades inte" }, { status: 404 });

  return NextResponse.json({ data: deleted });
}
