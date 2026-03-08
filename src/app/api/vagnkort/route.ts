import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { vehicles } from "@/lib/db/schemas";
import { eq, desc, or, ilike } from "drizzle-orm";
import { createVehicleSchema } from "@/lib/validations/vehicle";

export async function GET(request: NextRequest) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const customerId = searchParams.get("customer_id");
  const regNr      = searchParams.get("reg_nr");
  const search     = searchParams.get("search");
  const limit      = Math.min(50, parseInt(searchParams.get("limit") ?? "50"));

  let query = db.select({
    id:       vehicles.id,
    regNr:    vehicles.regNr,
    brand:    vehicles.brand,
    model:    vehicles.model,
    modelYear: vehicles.modelYear,
    customerId: vehicles.customerId,
  }).from(vehicles).orderBy(desc(vehicles.createdAt));

  if (customerId) query = query.where(eq(vehicles.customerId, customerId)) as typeof query;
  if (regNr)      query = query.where(ilike(vehicles.regNr, `%${regNr}%`)) as typeof query;
  if (search) {
    const pattern = `%${search}%`;
    query = query.where(
      or(
        ilike(vehicles.regNr, pattern),
        ilike(vehicles.brand, pattern),
        ilike(vehicles.model, pattern),
      ),
    ) as typeof query;
  }

  const data = await query.limit(limit);
  return NextResponse.json({ data });
}

export async function POST(request: NextRequest) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const parsed = createVehicleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Valideringsfel", details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const [vehicle] = await db.insert(vehicles).values(parsed.data).returning();
    return NextResponse.json({ data: vehicle }, { status: 201 });
  } catch (err: any) {
    // Handle unique constraint violation (duplicate regNr)
    if (err?.code === "23505" || err?.message?.includes("unique") || err?.message?.includes("duplicate")) {
      return NextResponse.json(
        { error: `Fordon med regnummer ${parsed.data.regNr} finns redan i systemet.` },
        { status: 409 },
      );
    }
    console.error("[vagnkort] Insert failed:", err);
    return NextResponse.json({ error: "Kunde inte spara fordonet." }, { status: 500 });
  }
}
