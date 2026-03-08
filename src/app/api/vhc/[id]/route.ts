import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { vehicleHealthChecks, vhcItems, vehicles, customers, workOrders } from "@/lib/db/schemas";
import { eq } from "drizzle-orm";

/**
 * GET /api/vhc/[id]
 * Get VHC with all items and vehicle/customer info.
 * Supports both UUID (by id) and token (by public_token) lookup.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const { id } = params;

  // Try by ID first, then by public token
  let vhcList = await db
    .select()
    .from(vehicleHealthChecks)
    .where(eq(vehicleHealthChecks.id, id));

  if (vhcList.length === 0) {
    vhcList = await db
      .select()
      .from(vehicleHealthChecks)
      .where(eq(vehicleHealthChecks.publicToken, id));
  }

  if (vhcList.length === 0) {
    return NextResponse.json({ error: "VHC hittades inte" }, { status: 404 });
  }

  const vhc = vhcList[0];

  // Get all items
  const items = await db
    .select()
    .from(vhcItems)
    .where(eq(vhcItems.checkId, vhc.id))
    .orderBy(vhcItems.sortOrder);

  // Get vehicle & customer info
  const [vehicle] = await db
    .select()
    .from(vehicles)
    .where(eq(vehicles.id, vhc.vehicleId));

  let customer = null;
  if (vehicle?.customerId) {
    const [c] = await db
      .select()
      .from(customers)
      .where(eq(customers.id, vehicle.customerId));
    customer = c ?? null;
  }

  // Get work order info
  const [wo] = await db
    .select({ orderNumber: workOrders.orderNumber, customerComplaint: workOrders.customerComplaint })
    .from(workOrders)
    .where(eq(workOrders.id, vhc.workOrderId));

  return NextResponse.json({
    ...vhc,
    items,
    vehicle: vehicle ? {
      id: vehicle.id,
      regNr: vehicle.regNr,
      brand: vehicle.brand,
      model: vehicle.model,
      modelYear: vehicle.modelYear,
      mileageKm: vehicle.mileageKm,
    } : null,
    customer: customer ? {
      firstName: customer.firstName,
      lastName: customer.lastName,
      companyName: customer.companyName,
      phone: customer.phone,
    } : null,
    workOrder: wo ?? null,
  });
}

/**
 * PUT /api/vhc/[id]
 * Update VHC metadata (status, notes).
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const updateFields: Record<string, unknown> = { updatedAt: new Date() };

  if (body.status) updateFields.status = body.status;
  if (body.notes !== undefined) updateFields.notes = body.notes;
  if (body.customerApprovedAt) updateFields.customerApprovedAt = new Date(body.customerApprovedAt);

  const [updated] = await db
    .update(vehicleHealthChecks)
    .set(updateFields)
    .where(eq(vehicleHealthChecks.id, params.id))
    .returning();

  if (!updated) {
    return NextResponse.json({ error: "VHC hittades inte" }, { status: 404 });
  }

  return NextResponse.json(updated);
}
