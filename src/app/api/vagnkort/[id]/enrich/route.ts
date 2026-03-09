import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { vehicles } from "@/lib/db/schemas";
import { eq } from "drizzle-orm";

const VEHICLE_LOOKUP_URL =
  process.env.VEHICLE_LOOKUP_URL ?? "http://localhost:8100";

// Fuel type mapping: Swedish → DB enum
const FUEL_MAP: Record<string, string> = {
  bensin: "petrol",
  diesel: "diesel",
  el: "electric",
  hybrid: "hybrid",
  laddhybrid: "plug_in_hybrid",
  etanol: "ethanol",
  gas: "lpg",
  vätgas: "hydrogen",
  petrol: "petrol",
  electric: "electric",
  plug_in_hybrid: "plug_in_hybrid",
  lpg: "lpg",
  hydrogen: "hydrogen",
};

const JUNK_ENGINE_CODES = new Set([
  "logga in", "login", "visa", "dölj", "premium", "pro", "köp",
  "nedc", "wltp", "euro 5", "euro 6", "euro 4",
  "okänt", "okänd", "okant", "okand", "unknown", "saknas", "missing", "n/a",
]);

const ROUTE_JUNK_CODES =
  /^(drag|dragkrok|ja|nej|finns|saknas|standard|ingen|inget|typ|bil|el|gas|manuell|automat|bensin|diesel|hybrid|awd|fwd|rwd|touring|coupe|sport|sedan|kombi|cab|van|suv)$/i;

function filterEngineCode(
  raw: string | null | undefined,
  model: string | null | undefined,
): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length < 2 || trimmed.length > 30) return null;
  if (ROUTE_JUNK_CODES.test(trimmed)) return null;
  if (JUNK_ENGINE_CODES.has(trimmed.toLowerCase())) return null;

  const lower = trimmed.toLowerCase();
  if (
    lower.includes("leather") || lower.includes("dakota") ||
    lower.includes("alcantara") || lower.includes("metallic") ||
    lower.includes("black/black") || /\([A-Z]{3,}\)/.test(trimmed)
  ) return null;
  if (/hämta|hamta|visa|logga|köp|dölj/i.test(trimmed)) return null;

  if (model && model.length >= 4) {
    const normCode = trimmed.toLowerCase().replace(/[\s\-_.]/g, "");
    const normModel = model.toLowerCase().replace(/[\s\-_.]/g, "");
    if (normModel.includes(normCode) || normCode.includes(normModel)) return null;
    const modelParts = model.split(/[\s\-_.]+/).filter((p) => p.length >= 4);
    for (const part of modelParts) {
      if (part.toLowerCase() === normCode) return null;
    }
  }
  return trimmed;
}

/**
 * POST /api/vagnkort/[id]/enrich
 * Enriches a single vehicle from the external scraper service.
 * Returns the updated vehicle + list of changed fields.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 1. Get vehicle from DB
  const [vehicle] = await db
    .select()
    .from(vehicles)
    .where(eq(vehicles.id, params.id))
    .limit(1);

  if (!vehicle) {
    return NextResponse.json({ error: "Fordonet hittades inte" }, { status: 404 });
  }

  // 2. Check scraper health
  let serviceAvailable = false;
  try {
    const healthRes = await fetch(`${VEHICLE_LOOKUP_URL}/health`, {
      signal: AbortSignal.timeout(2_000),
    });
    serviceAvailable = healthRes.ok;
  } catch {
    // not available
  }

  if (!serviceAvailable) {
    return NextResponse.json(
      { error: "Scrapern (MagicNUC) svarar inte" },
      { status: 503 },
    );
  }

  // 3. Call scraper
  let scraperData: any = null;
  try {
    const res = await fetch(`${VEHICLE_LOOKUP_URL}/lookup/${vehicle.regNr}`, {
      signal: AbortSignal.timeout(30_000),
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Scrapern svarade HTTP ${res.status}` },
        { status: 502 },
      );
    }

    const json = await res.json();

    if (json.captcha_required) {
      return NextResponse.json(
        { error: "CAPTCHA krävs — logga in via biluppgifter.se först" },
        { status: 403 },
      );
    }

    if (!json.success || !json.data) {
      return NextResponse.json(
        { error: "Fordonet hittades inte i externa källor", found: false },
        { status: 200 },
      );
    }

    scraperData = json.data;
  } catch (err: any) {
    return NextResponse.json(
      { error: `Timeout eller nätverksfel: ${err.message}` },
      { status: 504 },
    );
  }

  // 4. Build update object + track changes
  const updateFields: Record<string, unknown> = {};
  const updated: string[] = [];

  function setField(dbField: string, newValue: unknown, label: string) {
    if (newValue != null && newValue !== "") {
      const oldValue = (vehicle as any)[dbField];
      updateFields[dbField] = newValue;
      if (oldValue !== newValue) {
        updated.push(label);
      }
    }
  }

  if (scraperData.make && typeof scraperData.make === "string") {
    setField("brand", scraperData.make, "Märke");
  }
  if (scraperData.model && typeof scraperData.model === "string") {
    setField("model", scraperData.model, "Modell");
  }
  if (scraperData.year) {
    const year = typeof scraperData.year === "string" ? parseInt(scraperData.year, 10) : scraperData.year;
    if (!isNaN(year) && year > 1900 && year < 2100) {
      setField("modelYear", year, "Årsmodell");
    }
  }
  if (scraperData.color && typeof scraperData.color === "string") {
    setField("color", scraperData.color, "Färg");
  }

  const rawFuel = (scraperData.fuel_type ?? "").toLowerCase();
  const mappedFuel = FUEL_MAP[rawFuel] ?? null;
  if (mappedFuel) {
    setField("fuelType", mappedFuel, "Bränsle");
  }

  if (scraperData.engine_cc) {
    const cc = typeof scraperData.engine_cc === "string" ? parseInt(scraperData.engine_cc, 10) : scraperData.engine_cc;
    if (!isNaN(cc) && cc > 0) {
      setField("engineSizeCc", cc, "Motor CC");
    }
  }

  if (scraperData.power_kw) {
    const kw = typeof scraperData.power_kw === "string" ? parseInt(scraperData.power_kw, 10) : scraperData.power_kw;
    if (!isNaN(kw) && kw > 0) {
      setField("powerKw", kw, "Effekt");
      updateFields.powerHp = Math.round(kw * 1.341);
    }
  }

  if (scraperData.gearbox && typeof scraperData.gearbox === "string") {
    setField("transmission", scraperData.gearbox, "Växellåda");
  }
  if (scraperData.drive_type && typeof scraperData.drive_type === "string") {
    setField("driveType", scraperData.drive_type, "Drivning");
  }
  if (scraperData.vin && typeof scraperData.vin === "string" && scraperData.vin.length >= 10) {
    setField("vin", scraperData.vin, "VIN");
  }

  const filteredEngineCode = filterEngineCode(scraperData.engine_code, scraperData.model);
  if (filteredEngineCode) {
    setField("engineCode", filteredEngineCode, "Motorkod");
  }

  if (scraperData.mileage_km) {
    const km = typeof scraperData.mileage_km === "string" ? parseInt(scraperData.mileage_km, 10) : scraperData.mileage_km;
    if (!isNaN(km) && km > 0 && km < 2_000_000) {
      setField("mileageKm", km, "Miltal");
      updateFields.mileageUpdatedAt = new Date();
    }
  }

  // 5. Save to DB
  if (Object.keys(updateFields).length === 0) {
    return NextResponse.json({
      ok: true,
      vehicle,
      updated: [],
      message: "Ingen ny data att uppdatera",
    });
  }

  updateFields.externalData = scraperData;
  updateFields.externalFetchedAt = new Date();
  updateFields.updatedAt = new Date();

  try {
    const [updatedVehicle] = await db
      .update(vehicles)
      .set(updateFields)
      .where(eq(vehicles.id, params.id))
      .returning();

    return NextResponse.json({
      ok: true,
      vehicle: updatedVehicle,
      updated,
      message: updated.length > 0
        ? `${updated.length} fält uppdaterade: ${updated.join(", ")}`
        : "Data bekräftad (inga ändringar)",
    });
  } catch (err: any) {
    console.error("[enrich] DB update error:", err.message);
    return NextResponse.json(
      { error: "Databasfel vid sparning" },
      { status: 500 },
    );
  }
}
