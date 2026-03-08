import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { vehicleHealthChecks, vhcItems, workOrders, vehicles } from "@/lib/db/schemas";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";
import { VHC_CATEGORIES } from "@/lib/vhc/default-checklist";

/**
 * POST /api/vhc
 * Create a new VHC for a work order — generates default checklist items.
 * Body: { workOrderId: string }
 */
export async function POST(request: NextRequest) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { workOrderId } = await request.json();
  if (!workOrderId) {
    return NextResponse.json({ error: "workOrderId krävs" }, { status: 400 });
  }

  // Get work order to find vehicle
  const [wo] = await db
    .select({ vehicleId: workOrders.vehicleId })
    .from(workOrders)
    .where(eq(workOrders.id, workOrderId));

  if (!wo) {
    return NextResponse.json({ error: "Arbetsorder hittades inte" }, { status: 404 });
  }

  // Check if VHC already exists for this work order
  const existing = await db
    .select({ id: vehicleHealthChecks.id })
    .from(vehicleHealthChecks)
    .where(eq(vehicleHealthChecks.workOrderId, workOrderId));

  if (existing.length > 0) {
    return NextResponse.json({ id: existing[0].id, existing: true });
  }

  // Create VHC with unique public token
  const publicToken = randomUUID();
  const [vhc] = await db
    .insert(vehicleHealthChecks)
    .values({
      workOrderId,
      vehicleId: wo.vehicleId,
      mechanicId: user.id,
      publicToken,
      status: "draft",
    })
    .returning();

  // Generate default checklist items
  let sortOrder = 0;
  const items = VHC_CATEGORIES.flatMap((cat) =>
    cat.items.map((label) => ({
      checkId: vhc.id,
      category: cat.key,
      label,
      severity: "green" as const,
      sortOrder: sortOrder++,
    })),
  );

  await db.insert(vhcItems).values(items);

  return NextResponse.json({ id: vhc.id, publicToken, itemCount: items.length });
}
