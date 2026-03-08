import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { crmReminders } from "@/lib/db/schemas";
import { eq } from "drizzle-orm";

/**
 * PATCH /api/crm/reminders/[id]
 * Update reminder status (approve, dismiss).
 * Body: { status: "approved" | "dismissed" }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { status } = await request.json();
  if (!["approved", "dismissed"].includes(status)) {
    return NextResponse.json({ error: "Ogiltig status" }, { status: 400 });
  }

  const [updated] = await db
    .update(crmReminders)
    .set({
      status,
      approvedBy: status === "approved" ? user.id : null,
    })
    .where(eq(crmReminders.id, params.id))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "Påminnelse hittades inte" }, { status: 404 });
  }

  return NextResponse.json(updated);
}
