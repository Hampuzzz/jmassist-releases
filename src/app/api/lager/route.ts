import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { parts } from "@/lib/db/schemas";
import { eq, desc, and, lte, ilike, or } from "drizzle-orm";
import { z } from "zod";

const toStr = z.union([z.string(), z.number()]).transform((v) => String(v));

const createPartSchema = z.object({
  partNumber:     z.string().min(1),
  name:           z.string().min(1),
  description:    z.string().optional(),
  category:       z.string().optional(),
  unit:           z.string().optional(),
  costPrice:      toStr.optional(),
  sellPrice:      toStr.optional(),
  vatRatePct:     toStr.optional(),
  vmbEligible:    z.boolean().optional(),
  stockQty:       toStr.optional(),
  stockMinQty:    toStr.optional(),
  stockLocation:  z.string().optional(),
  supplierId:     z.string().uuid().optional().nullable(),
  notes:          z.string().optional(),
}).strict();

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

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ogiltig JSON" }, { status: 400 });
  }

  const parsed = createPartSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Valideringsfel", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const [part] = await db.insert(parts).values(parsed.data).returning();
    return NextResponse.json({ data: part }, { status: 201 });
  } catch (err: any) {
    console.error("[lager] POST error:", err);
    return NextResponse.json({ error: "Kunde inte skapa artikel" }, { status: 500 });
  }
}
