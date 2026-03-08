import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { workOrderParts } from "@/lib/db/schemas";
import { eq, and } from "drizzle-orm";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string; partLineId: string } },
) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [deleted] = await db
    .delete(workOrderParts)
    .where(
      and(
        eq(workOrderParts.id, params.partLineId),
        eq(workOrderParts.workOrderId, params.id),
      ),
    )
    .returning();

  if (!deleted) return NextResponse.json({ error: "Hittades inte" }, { status: 404 });

  return NextResponse.json({ data: deleted });
}
