import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { vhcItems } from "@/lib/db/schemas";
import { eq } from "drizzle-orm";

interface ItemUpdate {
  id: string;
  severity?: "green" | "yellow" | "red";
  comment?: string | null;
  estimatedCost?: string | null;
  customerApproved?: boolean;
  mediaUrls?: string[];
}

/**
 * PUT /api/vhc/[id]/items
 * Batch update VHC items. Accepts an array of item updates.
 * Body: { items: ItemUpdate[] }
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  // Allow both authenticated and anonymous (customer approval)
  const isAuth = !!user;

  const { items } = (await request.json()) as { items: ItemUpdate[] };

  if (!items || !Array.isArray(items)) {
    return NextResponse.json({ error: "items array krävs" }, { status: 400 });
  }

  const results = [];
  for (const item of items) {
    const updateFields: Record<string, unknown> = {};

    if (item.severity) updateFields.severity = item.severity;
    if (item.comment !== undefined) updateFields.comment = item.comment;
    if (item.estimatedCost !== undefined) updateFields.estimatedCost = item.estimatedCost;
    if (item.customerApproved !== undefined) updateFields.customerApproved = item.customerApproved;
    if (item.mediaUrls) updateFields.mediaUrls = item.mediaUrls;

    if (Object.keys(updateFields).length === 0) continue;

    // Only allow customer to update customerApproved (not severity/comment)
    if (!isAuth) {
      const allowedKeys = ["customerApproved"];
      const actualKeys = Object.keys(updateFields);
      const disallowed = actualKeys.filter((k) => !allowedKeys.includes(k));
      if (disallowed.length > 0) {
        continue; // Skip unauthorized field updates
      }
    }

    const [updated] = await db
      .update(vhcItems)
      .set(updateFields)
      .where(eq(vhcItems.id, item.id))
      .returning();

    if (updated) results.push(updated);
  }

  return NextResponse.json({ updated: results.length, items: results });
}
