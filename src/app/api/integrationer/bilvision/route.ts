import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { fetchVehicleByRegNr, mapBilvisionToVehicle } from "@/lib/integrations/bilvision/client";
import { regNrNormalize } from "@/lib/utils";

/**
 * GET /api/integrationer/bilvision?reg_nr=ABC123
 * Fetches vehicle data from Bilvision (or mock in development).
 * Returns raw API response mapped to our internal schema shape.
 */
export async function GET(request: NextRequest) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const regNr = request.nextUrl.searchParams.get("reg_nr");
  if (!regNr) return NextResponse.json({ error: "reg_nr krävs" }, { status: 400 });

  try {
    const raw = await fetchVehicleByRegNr(regNrNormalize(regNr));
    if (!raw) {
      return NextResponse.json({ error: "Fordonet hittades inte i registret" }, { status: 404 });
    }

    const mapped = mapBilvisionToVehicle(raw);
    return NextResponse.json({ data: mapped, raw });
  } catch (err) {
    console.error("[bilvision] API error:", err);
    return NextResponse.json({ error: "Fordonsdatatjänsten är otillgänglig" }, { status: 502 });
  }
}
