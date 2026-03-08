import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { blockedPeriods } from "@/lib/db/schemas";
import { eq } from "drizzle-orm";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const deleted = await db
      .delete(blockedPeriods)
      .where(eq(blockedPeriods.id, params.id))
      .returning();

    if (deleted.length === 0) {
      return NextResponse.json({ error: "Hittades ej" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[blocked-periods] Delete failed:", err);
    return NextResponse.json({ error: "Databasfel" }, { status: 500 });
  }
}
