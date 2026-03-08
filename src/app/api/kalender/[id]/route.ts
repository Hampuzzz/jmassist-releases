import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { appointments } from "@/lib/db/schemas";
import { eq } from "drizzle-orm";
import { updateAppointmentSchema } from "@/lib/validations/appointment";
import { checkResourceConflict } from "@/lib/scheduling/conflicts";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [appt] = await db
    .select()
    .from(appointments)
    .where(eq(appointments.id, params.id));

  if (!appt) return NextResponse.json({ error: "Hittades inte" }, { status: 404 });

  return NextResponse.json({ data: appt });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const parsed = updateAppointmentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Valideringsfel", details: parsed.error.flatten() }, { status: 400 });
  }

  // Check conflict if rescheduling
  if (parsed.data.resourceId && parsed.data.scheduledStart && parsed.data.scheduledEnd) {
    const conflict = await checkResourceConflict(
      parsed.data.resourceId,
      new Date(parsed.data.scheduledStart),
      new Date(parsed.data.scheduledEnd),
      params.id, // exclude self
    );
    if (conflict.hasConflict) {
      return NextResponse.json({ error: conflict.message }, { status: 409 });
    }
  }

  const [updated] = await db
    .update(appointments)
    .set(parsed.data)
    .where(eq(appointments.id, params.id))
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

  // Hard delete the appointment row
  const [deleted] = await db
    .delete(appointments)
    .where(eq(appointments.id, params.id))
    .returning();

  if (!deleted) return NextResponse.json({ error: "Hittades inte" }, { status: 404 });

  return NextResponse.json({ data: deleted });
}
