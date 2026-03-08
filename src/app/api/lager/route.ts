import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { parts } from "@/lib/db/schemas";
import { eq, desc, and, lte, ilike, or } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const search     = searchParams.get("search");
  const lowStock   = searchParams.get("low_stock") === "true";
  const supplierId = searchParams.get("supplier_id");
  const page  = Math.max(1, parseInt(searchParams.get("page")  ?? "1"));
  const limit = Math.min(100, parseInt(searchParams.get("limit") ?? "30"));

  const conditions: any[] = [eq(parts.isActive, true)];

  if (supplierId) conditions.push(eq(parts.supplierId, supplierId));
  if (search) {
    conditions.push(
      or(
        ilike(parts.name,           `%${search}%`),
        ilike(parts.partNumber,     `%${search}%`),
        ilike(parts.internalNumber, `%${search}%`),
      ),
    );
  }

  const query = db
    .select({
      id:            parts.id,
      partNumber:    parts.partNumber,
      name:          parts.name,
      category:      parts.category,
      costPrice:     parts.costPrice,
      sellPrice:     parts.sellPrice,
      stockQty:      parts.stockQty,
      stockMinQty:   parts.stockMinQty,
      stockLocation: parts.stockLocation,
      isActive:      parts.isActive,
    })
    .from(parts)
    .where(and(...conditions))
    .orderBy(desc(parts.updatedAt))
    .limit(limit)
    .offset((page - 1) * limit);

  const data = await query;

  // Filter low stock in application (avoids complex SQL with GENERATED columns)
  const filtered = lowStock
    ? data.filter((p) => parseFloat(p.stockQty) <= parseFloat(p.stockMinQty))
    : data;

  return NextResponse.json({ data: filtered, page, limit }, {
    headers: { "Cache-Control": "private, max-age=0, stale-while-revalidate=30" },
  });
}

export async function POST(request: NextRequest) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  // Basic validation inline (add zod schema for production)
  if (!body.name || !body.partNumber) {
    return NextResponse.json({ error: "Namn och artikelnummer krävs" }, { status: 400 });
  }

  const [part] = await db.insert(parts).values(body).returning();
  return NextResponse.json({ data: part }, { status: 201 });
}
