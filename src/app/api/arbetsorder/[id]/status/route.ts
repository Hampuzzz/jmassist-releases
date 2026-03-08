import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { workOrders } from "@/lib/db/schemas";
import { eq } from "drizzle-orm";
import { updateWorkOrderStatusSchema } from "@/lib/validations/work-order";
import { VALID_STATUS_TRANSITIONS } from "@/lib/constants";
import { notifyStatusChange } from "@/lib/notifications/engine";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const parsed = updateWorkOrderStatusSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Ogiltigt status" }, { status: 400 });
  }

  const [current] = await db
    .select({ status: workOrders.status })
    .from(workOrders)
    .where(eq(workOrders.id, params.id));

  if (!current) return NextResponse.json({ error: "Hittades inte" }, { status: 404 });

  const allowed = VALID_STATUS_TRANSITIONS[current.status] ?? [];
  if (!allowed.includes(parsed.data.status)) {
    return NextResponse.json(
      { error: `Kan inte övergå från ${current.status} till ${parsed.data.status}` },
      { status: 422 },
    );
  }

  const [updated] = await db
    .update(workOrders)
    .set({ status: parsed.data.status })
    .where(eq(workOrders.id, params.id))
    .returning();

  // Fire-and-forget SMS notification (don't block response)
  notifyStatusChange(params.id, parsed.data.status).catch(() => {});

  return NextResponse.json({ data: updated });
}
