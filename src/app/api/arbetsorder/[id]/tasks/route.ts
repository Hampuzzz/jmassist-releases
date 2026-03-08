import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { workOrderTasks } from "@/lib/db/schemas";
import { eq, asc } from "drizzle-orm";
import { createWorkOrderTaskSchema } from "@/lib/validations/work-order";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tasks = await db
    .select()
    .from(workOrderTasks)
    .where(eq(workOrderTasks.workOrderId, params.id))
    .orderBy(asc(workOrderTasks.sortOrder));

  return NextResponse.json({ data: tasks });
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const parsed = createWorkOrderTaskSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Valideringsfel", details: parsed.error.flatten() }, { status: 400 });
  }

  const [task] = await db
    .insert(workOrderTasks)
    .values({
      workOrderId: params.id,
      description: parsed.data.description,
      estimatedHours: parsed.data.estimatedHours?.toString(),
      assignedTo: parsed.data.assignedTo,
      sortOrder: parsed.data.sortOrder ?? 0,
    })
    .returning();

  return NextResponse.json({ data: task }, { status: 201 });
}
