import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { vehicles } from "@/lib/db/schemas";
import { eq } from "drizzle-orm";
import { getDiagnosis } from "@/lib/ai/diagnosis";

/**
 * POST /api/ai/diagnosis
 * Get AI-powered diagnosis for a DTC code.
 * Body: { dtcCode: string, vehicleId?: string }
 */
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

  const { dtcCode, vehicleId } = body;
  if (!dtcCode) {
    return NextResponse.json({ error: "dtcCode krävs" }, { status: 400 });
  }

  try {
    let make: string | undefined;
    let model: string | undefined;
    let year: number | undefined;

    if (vehicleId) {
      const [v] = await db
        .select({ brand: vehicles.brand, model: vehicles.model, modelYear: vehicles.modelYear })
        .from(vehicles)
        .where(eq(vehicles.id, vehicleId));
      if (v) {
        make = v.brand;
        model = v.model;
        year = v.modelYear ?? undefined;
      }
    }

    const result = await getDiagnosis(dtcCode, make, model, year);
    return NextResponse.json(result);
  } catch (err: any) {
    console.error("[ai/diagnosis] Error:", err);
    return NextResponse.json({ error: "Diagnos misslyckades" }, { status: 500 });
  }
}
