import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { workOrderTasks } from "@/lib/db/schemas";
import { eq, and } from "drizzle-orm";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; taskId: string } },
) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const updateData: Record<string, any> = {};

  if (body.description !== undefined) updateData.description = body.description;
  if (body.estimatedHours !== undefined) updateData.estimatedHours = body.estimatedHours?.toString();
  if (body.actualHours !== undefined) updateData.actualHours = body.actualHours?.toString();
  if (body.isCompleted !== undefined) {
    updateData.isCompleted = body.isCompleted;
    if (body.isCompleted) updateData.completedAt = new Date();
    else updateData.completedAt = null;
  }

  const [updated] = await db
    .update(workOrderTasks)
    .set(updateData)
    .where(
      and(
        eq(workOrderTasks.id, params.taskId),
        eq(workOrderTasks.workOrderId, params.id),
      ),
    )
    .returning();

  if (!updated) return NextResponse.json({ error: "Hittades inte" }, { status: 404 });

  return NextResponse.json({ data: updated });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string; taskId: string } },
) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [deleted] = await db
    .delete(workOrderTasks)
    .where(
      and(
        eq(workOrderTasks.id, params.taskId),
        eq(workOrderTasks.workOrderId, params.id),
      ),
    )
    .returning();

  if (!deleted) return NextResponse.json({ error: "Hittades inte" }, { status: 404 });

  return NextResponse.json({ data: deleted });
}
