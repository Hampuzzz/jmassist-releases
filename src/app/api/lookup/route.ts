import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { vehicles, customers, workOrders } from "@/lib/db/schemas";
import { eq, desc } from "drizzle-orm";

const VEHICLE_LOOKUP_URL = process.env.VEHICLE_LOOKUP_URL ?? "http://localhost:8100";

/**
 * POST /api/lookup
 * Bridge endpoint: looks up a vehicle by RegNr.
 *
 * Priority chain:
 *   1. Local DB (instant)
 *   2. Vehicle Lookup Service — Playwright-based headless browser scraper
 *      on localhost:8100 (biluppgifter.se → car.info)
 *   3. Paid APIs / mock data (bilvision client fallback)
 */
export async function POST(request: NextRequest) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const regNr = (body.regNr ?? body.reg_nr ?? "").toUpperCase().replace(/[\s-]/g, "");

  if (!regNr || regNr.length < 2) {
    return NextResponse.json({ error: "Regnummer krävs" }, { status: 400 });
  }

  // ── Step 1: Check local DB ──────────────────────────────────────────
  try {
    const [dbVehicle] = await db
      .select()
      .from(vehicles)
      .where(eq(vehicles.regNr, regNr))
      .limit(1);

    if (dbVehicle) {
      let localCustomer: any = null;
      if (dbVehicle.customerId) {
        const [cust] = await db
          .select()
          .from(customers)
          .where(eq(customers.id, dbVehicle.customerId))
          .limit(1);
        localCustomer = cust ?? null;
      }

      const serviceHistory = await db
        .select({
          id:                workOrders.id,
          orderNumber:       workOrders.orderNumber,
          status:            workOrders.status,
          customerComplaint: workOrders.customerComplaint,
          receivedAt:        workOrders.receivedAt,
          completedAt:       workOrders.finishedAt,
        })
        .from(workOrders)
        .where(eq(workOrders.vehicleId, dbVehicle.id))
        .orderBy(desc(workOrders.receivedAt))
        .limit(20);

      return NextResponse.json({
        found: true,
        exists_in_db: true,
        vehicle: dbVehicle,
        customer: localCustomer,
        service_history: serviceHistory.map((wo) => ({
          ...wo,
          receivedAt: wo.receivedAt instanceof Date ? wo.receivedAt.toISOString() : wo.receivedAt,
          completedAt: wo.completedAt instanceof Date ? wo.completedAt.toISOString() : wo.completedAt,
        })),
        source: "local_db",
      });
    }
  } catch (err) {
    console.error("[lookup] DB check failed:", err);
  }

  // ── Step 2: Vehicle Lookup Service (Playwright scraper on port 8100) ─
  // Tries biluppgifter.se then car.info using a real headless browser.
  // Start with: node scripts/vehicle-lookup-service.mjs
  let scraperServiceAvailable = false;
  try {
    const healthRes = await fetch(`${VEHICLE_LOOKUP_URL}/health`, {
      signal: AbortSignal.timeout(1_500),
    });
    scraperServiceAvailable = healthRes.ok;
  } catch {
    // Service not running — skip to fallback
  }

  if (scraperServiceAvailable) {
    try {
      const res = await fetch(`${VEHICLE_LOOKUP_URL}/lookup/${regNr}`, {
        signal: AbortSignal.timeout(30_000),
      });

      if (res.ok) {
        const json = await res.json();

        if (json.captcha_required) {
          return NextResponse.json({
            found: false,
            captcha_required: true,
            captcha_message: json.message ?? "CAPTCHA krävs — lös den i webbläsaren och försök igen.",
            vehicle: null,
            customer: null,
            service_history: [],
            source: "scraper_service",
          });
        }

        if (json.success && json.data) {
          return NextResponse.json({
            found: true,
            exists_in_db: false,
            vehicle: {
              regNr,
              brand:          json.data.make ?? null,
              model:          json.data.model ?? null,
              modelYear:      json.data.year ?? null,
              color:          json.data.color ?? null,
              fuelType:       json.data.fuel_type ?? null,
              engineSizeCc:   json.data.engine_cc ?? null,
              powerKw:        json.data.power_kw ?? null,
              engineCode:     json.data.engine_code ?? null,
              transmission:   json.data.gearbox ?? null,
              driveType:      json.data.drive_type ?? null,
              vin:            json.data.vin ?? null,
              mileageKm:      json.data.mileage_km ?? null,
            },
            customer: null,
            service_history: [],
            source: json.data.source ?? "scraper_service",
          });
        }
      }
    } catch (err) {
      console.log("[lookup] Scraper service timed out or failed:", (err as Error).message);
    }
  }

  // ── Step 3: Fallback — paid APIs / mock data ────────────────────────
  try {
    const { fetchVehicleByRegNr } = await import("@/lib/integrations/bilvision/client");
    const extData = await fetchVehicleByRegNr(regNr);

    if (extData) {
      return NextResponse.json({
        found: true,
        exists_in_db: false,
        vehicle: {
          regNr:        extData.regNr,
          brand:        extData.brand,
          model:        extData.model,
          modelYear:    extData.modelYear,
          color:        extData.color ?? null,
          fuelType:     extData.fuelType ?? null,
          engineSizeCc: extData.engineSizeCC ?? null,
          powerKw:      extData.powerKw ?? null,
          transmission: extData.transmission ?? null,
          driveType:    extData.driveType ?? null,
          vin:          extData.vin ?? null,
        },
        customer: null,
        service_history: [],
        source: "external_api",
      });
    }
  } catch (err) {
    console.error("[lookup] External lookup failed:", err);
  }

  return NextResponse.json({
    found: false,
    exists_in_db: false,
    vehicle: null,
    customer: null,
    service_history: [],
    source: null,
  });
}
