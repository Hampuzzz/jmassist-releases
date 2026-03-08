import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { appointments } from "@/lib/db/schemas";
import { and, gte, lte, eq, ne } from "drizzle-orm";
import { createAppointmentSchema } from "@/lib/validations/appointment";
import { checkResourceConflict } from "@/lib/scheduling/conflicts";

export async function GET(request: NextRequest) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const start = searchParams.get("start");
  const end   = searchParams.get("end");

  const conditions: any[] = [ne(appointments.status, "cancelled")];
  if (start) conditions.push(gte(appointments.scheduledStart, new Date(start)));
  if (end)   conditions.push(lte(appointments.scheduledEnd,   new Date(end)));

  const data = await db
    .select()
    .from(appointments)
    .where(and(...conditions))
    .orderBy(appointments.scheduledStart);

  return NextResponse.json({ data });
}

export async function POST(request: NextRequest) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const parsed = createAppointmentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Valideringsfel", details: parsed.error.flatten() }, { status: 400 });
  }

  // Check resource conflict before insert
  if (parsed.data.resourceId) {
    const conflict = await checkResourceConflict(
      parsed.data.resourceId,
      new Date(parsed.data.scheduledStart),
      new Date(parsed.data.scheduledEnd),
    );
    if (conflict.hasConflict) {
      return NextResponse.json({ error: conflict.message }, { status: 409 });
    }
  }

  const [appointment] = await db
    .insert(appointments)
    .values({ ...parsed.data, createdBy: user.id })
    .returning();

  return NextResponse.json({ data: appointment }, { status: 201 });
}
