import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { vehicles, customers } from "@/lib/db/schemas";
import { eq } from "drizzle-orm";
import { fetchVehicleByRegNr, mapBilvisionToVehicle } from "@/lib/integrations/bilvision/client";
import { regNrNormalize } from "@/lib/utils";

/**
 * GET /api/vagnkort/sok?reg_nr=ABC123  (or ?q=ABC123)
 * First checks local DB, then calls external Bilvision API if not found.
 * Returns vehicle + customer data if linked.
 */
export async function GET(request: NextRequest) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const regNr = request.nextUrl.searchParams.get("reg_nr") ?? request.nextUrl.searchParams.get("q");
  if (!regNr) return NextResponse.json({ error: "reg_nr krävs" }, { status: 400 });

  const normalized = regNrNormalize(regNr);

  // Check local DB first — include customer join
  const [existingVehicle] = await db
    .select({
      id:                vehicles.id,
      regNr:             vehicles.regNr,
      vin:               vehicles.vin,
      brand:             vehicles.brand,
      model:             vehicles.model,
      modelYear:         vehicles.modelYear,
      color:             vehicles.color,
      fuelType:          vehicles.fuelType,
      mileageKm:         vehicles.mileageKm,
      customerId:        vehicles.customerId,
      customerFirstName: customers.firstName,
      customerLastName:  customers.lastName,
      customerCompany:   customers.companyName,
      customerPhone:     customers.phone,
      customerEmail:     customers.email,
    })
    .from(vehicles)
    .leftJoin(customers, eq(vehicles.customerId, customers.id))
    .where(eq(vehicles.regNr, normalized));

  if (existingVehicle) {
    return NextResponse.json({
      data: {
        id:         existingVehicle.id,
        regNr:      existingVehicle.regNr,
        vin:        existingVehicle.vin,
        brand:      existingVehicle.brand,
        model:      existingVehicle.model,
        modelYear:  existingVehicle.modelYear,
        color:      existingVehicle.color,
        fuelType:   existingVehicle.fuelType,
        mileageKm:  existingVehicle.mileageKm,
        customerId: existingVehicle.customerId,
        customer: existingVehicle.customerId
          ? {
              id:          existingVehicle.customerId,
              firstName:   existingVehicle.customerFirstName,
              lastName:    existingVehicle.customerLastName,
              companyName: existingVehicle.customerCompany,
              phone:       existingVehicle.customerPhone,
              email:       existingVehicle.customerEmail,
            }
          : null,
      },
      source: "local",
    });
  }

  // Fetch from external API
  try {
    const externalData = await fetchVehicleByRegNr(normalized);
    if (!externalData) {
      return NextResponse.json({ error: "Fordonet hittades inte" }, { status: 404 });
    }

    const mapped = mapBilvisionToVehicle(externalData);
    return NextResponse.json({ data: mapped, source: "external" });
  } catch (err) {
    console.error("[vagnkort/sok] External API error:", err);
    return NextResponse.json(
      { error: "Kunde inte hämta fordonsinformation" },
      { status: 502 },
    );
  }
}
