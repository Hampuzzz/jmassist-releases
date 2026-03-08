import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { blockedPeriods } from "@/lib/db/schemas";

export async function POST(request: NextRequest) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { title, blockStart, blockEnd, resourceId, mechanicId } = body;

  if (!title || !blockStart || !blockEnd) {
    return NextResponse.json({ error: "title, blockStart, blockEnd krävs" }, { status: 400 });
  }

  if (new Date(blockEnd) <= new Date(blockStart)) {
    return NextResponse.json({ error: "blockEnd måste vara efter blockStart" }, { status: 400 });
  }

  try {
    const [record] = await db
      .insert(blockedPeriods)
      .values({
        title,
        blockStart: new Date(blockStart),
        blockEnd: new Date(blockEnd),
        resourceId: resourceId ?? null,
        mechanicId: mechanicId ?? null,
        createdBy: user.id,
      })
      .returning();

    return NextResponse.json({ data: record }, { status: 201 });
  } catch (err) {
    console.error("[blocked-periods] Insert failed:", err);
    return NextResponse.json({ error: "Databasfel" }, { status: 500 });
  }
}
