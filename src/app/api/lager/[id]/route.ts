import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { parts } from "@/lib/db/schemas";
import { eq } from "drizzle-orm";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [part] = await db.select().from(parts).where(eq(parts.id, params.id));
  if (!part) return NextResponse.json({ error: "Artikel hittades inte" }, { status: 404 });

  return NextResponse.json({ data: part });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();

  // Whitelist of updatable fields
  const allowed: Record<string, string> = {
    stockQty: "stock_qty",
    costPrice: "cost_price",
    sellPrice: "sell_price",
    stockMinQty: "stock_min_qty",
    stockLocation: "stock_location",
    name: "name",
    partNumber: "part_number",
    category: "category",
    markupPct: "markup_pct",
    unit: "unit",
    isActive: "is_active",
  };

  const updates: Record<string, any> = {};
  for (const [key, value] of Object.entries(body)) {
    if (key in allowed && value !== undefined) {
      updates[key] = value;
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Inga giltiga fält att uppdatera" }, { status: 400 });
  }

  try {
    const [updated] = await db
      .update(parts)
      .set(updates)
      .where(eq(parts.id, params.id))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Artikel hittades inte" }, { status: 404 });
    }

    return NextResponse.json({ data: updated });
  } catch (err: any) {
    console.error("[lager/PATCH] Failed:", err);
    return NextResponse.json({ error: err.message ?? "Uppdatering misslyckades" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Soft delete — mark inactive
  const [updated] = await db
    .update(parts)
    .set({ isActive: false })
    .where(eq(parts.id, params.id))
    .returning({ id: parts.id });

  if (!updated) {
    return NextResponse.json({ error: "Artikel hittades inte" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
