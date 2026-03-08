import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { openingHours } from "@/lib/db/schemas";
import { eq } from "drizzle-orm";

/**
 * PUT /api/oppettider
 * Bulk-update all opening hours rows.
 */
export async function PUT(request: NextRequest) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { hours } = body;

  if (!Array.isArray(hours) || hours.length === 0) {
    return NextResponse.json({ error: "hours array required" }, { status: 400 });
  }

  // Validate each row
  for (const h of hours) {
    if (!h.id || !h.dayOfWeek) {
      return NextResponse.json({ error: "Varje rad behöver id och dayOfWeek" }, { status: 400 });
    }
    if (h.isClosed !== "true" && h.isClosed !== "false") {
      return NextResponse.json({ error: "isClosed must be 'true' or 'false'" }, { status: 400 });
    }
  }

  try {
    // Update each row individually (7 rows max)
    for (const h of hours) {
      await db
        .update(openingHours)
        .set({
          openTime:  h.openTime,
          closeTime: h.closeTime,
          isClosed:  h.isClosed,
        })
        .where(eq(openingHours.id, h.id));
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[oppettider] Update failed:", err);
    return NextResponse.json({ error: "Databasfel" }, { status: 500 });
  }
}
