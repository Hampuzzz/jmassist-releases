import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { resources } from "@/lib/db/schemas";
import { eq } from "drizzle-orm";

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();

  // Only allow these fields to be updated
  const allowed: Record<string, unknown> = {};
  if (body.name !== undefined) allowed.name = body.name;
  if (body.resourceType !== undefined) allowed.resourceType = body.resourceType;
  if (body.isActive !== undefined) allowed.isActive = body.isActive;
  if (body.notes !== undefined) allowed.notes = body.notes;
  if (body.sortOrder !== undefined) allowed.sortOrder = body.sortOrder;

  if (Object.keys(allowed).length === 0) {
    return NextResponse.json({ error: "Inget att uppdatera" }, { status: 400 });
  }

  try {
    const [updated] = await db
      .update(resources)
      .set(allowed)
      .where(eq(resources.id, params.id))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Hittades ej" }, { status: 404 });
    }

    return NextResponse.json({ data: updated });
  } catch (err) {
    console.error("[resurser] Update failed:", err);
    return NextResponse.json({ error: "Databasfel" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const deleted = await db
      .delete(resources)
      .where(eq(resources.id, params.id))
      .returning();

    if (deleted.length === 0) {
      return NextResponse.json({ error: "Hittades ej" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[resurser] Delete failed:", err);
    return NextResponse.json({ error: "Databasfel" }, { status: 500 });
  }
}
