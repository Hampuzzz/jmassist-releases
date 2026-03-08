import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { suppliers, parts } from "@/lib/db/schemas";
import { eq, desc, ilike, or, sql } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search");

  const data = await db
    .select({
      id:                  suppliers.id,
      name:                suppliers.name,
      orgNr:               suppliers.orgNr,
      contactName:         suppliers.contactName,
      email:               suppliers.email,
      phone:               suppliers.phone,
      city:                suppliers.city,
      integrationType:     suppliers.integrationType,
      defaultLeadTimeDays: suppliers.defaultLeadTimeDays,
      isActive:            suppliers.isActive,
      createdAt:           suppliers.createdAt,
      partCount:           sql<number>`(SELECT count(*) FROM parts WHERE parts.supplier_id = ${suppliers.id})`,
    })
    .from(suppliers)
    .where(
      search
        ? or(
            ilike(suppliers.name, `%${search}%`),
            ilike(suppliers.contactName, `%${search}%`),
            ilike(suppliers.email, `%${search}%`),
          )
        : undefined,
    )
    .orderBy(desc(suppliers.createdAt));

  return NextResponse.json({ data });
}

export async function POST(request: NextRequest) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();

  if (!body.name?.trim()) {
    return NextResponse.json({ error: "Namn krävs" }, { status: 400 });
  }

  const [supplier] = await db.insert(suppliers).values({
    name:                body.name.trim(),
    orgNr:               body.orgNr?.trim() || null,
    contactName:         body.contactName?.trim() || null,
    email:               body.email?.trim() || null,
    phone:               body.phone?.trim() || null,
    addressLine1:        body.addressLine1?.trim() || null,
    postalCode:          body.postalCode?.trim() || null,
    city:                body.city?.trim() || null,
    integrationType:     body.integrationType || null,
    defaultLeadTimeDays: body.defaultLeadTimeDays ? parseInt(body.defaultLeadTimeDays) : null,
    notes:               body.notes?.trim() || null,
  }).returning();

  return NextResponse.json({ data: supplier }, { status: 201 });
}
