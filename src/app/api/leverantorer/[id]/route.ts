import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { suppliers } from "@/lib/db/schemas";
import { eq } from "drizzle-orm";

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [supplier] = await db
    .select()
    .from(suppliers)
    .where(eq(suppliers.id, params.id));

  if (!supplier) return NextResponse.json({ error: "Hittades inte" }, { status: 404 });

  return NextResponse.json({ data: supplier });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();

  const setData: Record<string, unknown> = {};
  if (body.name !== undefined)                setData.name = body.name.trim();
  if (body.orgNr !== undefined)               setData.orgNr = body.orgNr?.trim() || null;
  if (body.contactName !== undefined)         setData.contactName = body.contactName?.trim() || null;
  if (body.email !== undefined)               setData.email = body.email?.trim() || null;
  if (body.phone !== undefined)               setData.phone = body.phone?.trim() || null;
  if (body.addressLine1 !== undefined)        setData.addressLine1 = body.addressLine1?.trim() || null;
  if (body.postalCode !== undefined)          setData.postalCode = body.postalCode?.trim() || null;
  if (body.city !== undefined)                setData.city = body.city?.trim() || null;
  if (body.integrationType !== undefined)     setData.integrationType = body.integrationType || null;
  if (body.defaultLeadTimeDays !== undefined) setData.defaultLeadTimeDays = body.defaultLeadTimeDays ? parseInt(body.defaultLeadTimeDays) : null;
  if (body.notes !== undefined)               setData.notes = body.notes?.trim() || null;
  if (body.isActive !== undefined)            setData.isActive = body.isActive;

  if (Object.keys(setData).length === 0) {
    return NextResponse.json({ error: "Inget att uppdatera" }, { status: 400 });
  }

  setData.updatedAt = new Date();

  const [updated] = await db
    .update(suppliers)
    .set(setData)
    .where(eq(suppliers.id, params.id))
    .returning();

  if (!updated) return NextResponse.json({ error: "Hittades inte" }, { status: 404 });

  return NextResponse.json({ data: updated });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Parts referencing this supplier will have supplier_id set to NULL (onDelete: "set null")
  const [deleted] = await db
    .delete(suppliers)
    .where(eq(suppliers.id, params.id))
    .returning();

  if (!deleted) return NextResponse.json({ error: "Hittades inte" }, { status: 404 });

  return NextResponse.json({ data: deleted });
}
