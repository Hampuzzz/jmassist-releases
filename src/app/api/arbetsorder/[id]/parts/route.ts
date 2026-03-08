import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { workOrderParts, parts } from "@/lib/db/schemas";
import { eq } from "drizzle-orm";
import { addWorkOrderPartSchema } from "@/lib/validations/work-order";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const parsed = addWorkOrderPartSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Valideringsfel", details: parsed.error.flatten() }, { status: 400 });
  }

  // Fetch part for default prices
  const [part] = await db
    .select()
    .from(parts)
    .where(eq(parts.id, parsed.data.partId));

  if (!part) return NextResponse.json({ error: "Del hittades inte" }, { status: 404 });

  const sellPrice = parsed.data.unitSellPrice ?? parseFloat(part.sellPrice);
  const costPrice = parseFloat(part.costPrice);

  const [line] = await db
    .insert(workOrderParts)
    .values({
      workOrderId:   params.id,
      partId:        parsed.data.partId,
      quantity:      parsed.data.quantity.toString(),
      unitCostPrice: costPrice.toString(),
      unitSellPrice: sellPrice.toString(),
      vmbEligible:   parsed.data.vmbEligible ?? false,
      costBasis:     parsed.data.costBasis?.toString(),
      addedBy:       user.id,
      notes:         parsed.data.notes,
    })
    .returning();

  return NextResponse.json({ data: line }, { status: 201 });
}
