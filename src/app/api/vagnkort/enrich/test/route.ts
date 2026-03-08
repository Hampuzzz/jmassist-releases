import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { vehicles } from "@/lib/db/schemas";
import { eq, and, or, isNull } from "drizzle-orm";

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

/**
 * GET /api/vagnkort/enrich/test
 *
 * Diagnostic endpoint — tests enrichment for ONE vehicle step by step.
 * Returns detailed info about each step to help debug save issues.
 *
 * Query params:
 *   ?regNr=ABC123  — test a specific vehicle (optional, picks first in queue otherwise)
 */
export async function GET(request: NextRequest) {
  const steps: Array<{ step: string; status: string; data?: unknown }> = [];

  try {
    // Step 1: Check lookup service health
    let serviceOk = false;
    try {
      const healthRes = await fetch(`${VEHICLE_LOOKUP_URL}/health`, {
        signal: AbortSignal.timeout(3_000),
      });
      const healthData = await healthRes.json().catch(() => null);
      serviceOk = healthRes.ok;
      steps.push({
        step: "1. Lookup service health",
        status: serviceOk ? "✅ OK" : "❌ FAIL",
        data: healthData,
      });
    } catch (err: any) {
      steps.push({
        step: "1. Lookup service health",
        status: "❌ NOT RUNNING",
        data: { error: err.message, url: `${VEHICLE_LOOKUP_URL}/health` },
      });
      return Response.json({ steps }, { status: 503 });
    }

    // Step 2: Pick a vehicle from queue
    const targetRegNr = request.nextUrl.searchParams.get("regNr")?.toUpperCase().replace(/[\s-]/g, "");

    let vehicle;
    if (targetRegNr) {
      const found = await db
        .select()
        .from(vehicles)
        .where(eq(vehicles.regNr, targetRegNr))
        .limit(1);
      vehicle = found[0];
    } else {
      const queue = await db
        .select()
        .from(vehicles)
        .where(
          and(
            vehicles.isActive,
            or(
              isNull(vehicles.vin),
              eq(vehicles.brand, "Okänt"),
              isNull(vehicles.fuelType),
              isNull(vehicles.powerKw),
            ),
          ),
        )
        .limit(1);
      vehicle = queue[0];
    }

    if (!vehicle) {
      steps.push({
        step: "2. Find vehicle",
        status: "❌ NO VEHICLE FOUND",
        data: targetRegNr ? { searched: targetRegNr } : "Queue is empty",
      });
      return Response.json({ steps });
    }

    steps.push({
      step: "2. Find vehicle",
      status: "✅ Found",
      data: {
        id: vehicle.id,
        regNr: vehicle.regNr,
        brand: vehicle.brand,
        model: vehicle.model,
        vin: vehicle.vin,
        fuelType: vehicle.fuelType,
        powerKw: vehicle.powerKw,
        engineCode: vehicle.engineCode,
      },
    });

    // Step 3: Call lookup service
    let lookupResult: any = null;
    try {
      const lookupRes = await fetch(
        `${VEHICLE_LOOKUP_URL}/lookup/${vehicle.regNr}`,
        { signal: AbortSignal.timeout(35_000) },
      );

      const lookupStatus = lookupRes.status;
      const lookupBody = await lookupRes.text();

      steps.push({
        step: "3a. Lookup HTTP response",
        status: lookupRes.ok ? `✅ HTTP ${lookupStatus}` : `❌ HTTP ${lookupStatus}`,
        data: { status: lookupStatus, bodyLength: lookupBody.length, bodyPreview: lookupBody.substring(0, 500) },
      });

      try {
        lookupResult = JSON.parse(lookupBody);
      } catch {
        steps.push({
          step: "3b. Parse lookup JSON",
          status: "❌ INVALID JSON",
          data: { raw: lookupBody.substring(0, 300) },
        });
        return Response.json({ steps });
      }

      steps.push({
        step: "3b. Lookup result",
        status: lookupResult.success ? "✅ SUCCESS" : "❌ NO DATA",
        data: lookupResult,
      });
    } catch (err: any) {
      steps.push({
        step: "3. Lookup service call",
        status: "❌ FAILED",
        data: { error: err.message },
      });
      return Response.json({ steps });
    }

    if (!lookupResult?.success || !lookupResult?.data) {
      steps.push({
        step: "4. Build update",
        status: "⚠️ SKIPPED — no data from lookup",
      });
      return Response.json({ steps });
    }

    const data = lookupResult.data;

    // Step 4: Build update fields (same logic as enrich route)
    const rawFuel = (data.fuel_type ?? "").toLowerCase();
    const mappedFuel = FUEL_MAP[rawFuel] ?? null;

    const updateFields: Record<string, unknown> = {};
    let dataFieldCount = 0;

    if (data.make && typeof data.make === "string") {
      updateFields.brand = data.make;
      dataFieldCount++;
    }
    if (data.model && typeof data.model === "string") {
      updateFields.model = data.model;
      dataFieldCount++;
    }
    if (data.year) {
      const year = typeof data.year === "string" ? parseInt(data.year, 10) : data.year;
      if (!isNaN(year) && year > 1900 && year < 2100) {
        updateFields.modelYear = year;
        dataFieldCount++;
      }
    }
    if (data.color && typeof data.color === "string") {
      updateFields.color = data.color;
      dataFieldCount++;
    }
    if (mappedFuel) {
      updateFields.fuelType = mappedFuel;
      dataFieldCount++;
    }
    if (data.engine_cc) {
      const cc = typeof data.engine_cc === "string" ? parseInt(data.engine_cc, 10) : data.engine_cc;
      if (!isNaN(cc) && cc > 0) {
        updateFields.engineSizeCc = cc;
        dataFieldCount++;
      }
    }
    if (data.power_kw) {
      const kw = typeof data.power_kw === "string" ? parseInt(data.power_kw, 10) : data.power_kw;
      if (!isNaN(kw) && kw > 0) {
        updateFields.powerKw = kw;
        dataFieldCount++;
      }
    }
    if (data.gearbox && typeof data.gearbox === "string") {
      updateFields.transmission = data.gearbox;
      dataFieldCount++;
    }
    if (data.drive_type && typeof data.drive_type === "string") {
      updateFields.driveType = data.drive_type;
      dataFieldCount++;
    }
    if (data.vin && typeof data.vin === "string" && data.vin.length >= 10) {
      updateFields.vin = data.vin;
      dataFieldCount++;
    }
    if (data.engine_code && typeof data.engine_code === "string") {
      updateFields.engineCode = data.engine_code;
      dataFieldCount++;
    }

    steps.push({
      step: "4. Build update fields",
      status: dataFieldCount > 0 ? `✅ ${dataFieldCount} fields` : "❌ 0 fields",
      data: {
        dataFieldCount,
        rawFuel,
        mappedFuel,
        updateFields,
      },
    });

    if (dataFieldCount === 0) {
      return Response.json({ steps });
    }

    // Add metadata
    updateFields.externalData = data;
    updateFields.externalFetchedAt = new Date();
    updateFields.updatedAt = new Date();

    // Step 5: Try DB update
    try {
      const result = await db
        .update(vehicles)
        .set(updateFields)
        .where(eq(vehicles.id, vehicle.id))
        .returning({ id: vehicles.id, regNr: vehicles.regNr });

      steps.push({
        step: "5. DB update",
        status: "✅ EXECUTED",
        data: { returning: result, fieldsSet: Object.keys(updateFields) },
      });
    } catch (dbErr: any) {
      steps.push({
        step: "5. DB update",
        status: "❌ DB ERROR",
        data: {
          error: dbErr.message,
          code: dbErr.code,
          detail: dbErr.detail,
          updateFields: JSON.parse(JSON.stringify(updateFields, (_, v) =>
            v instanceof Date ? v.toISOString() : v
          )),
        },
      });
      return Response.json({ steps });
    }

    // Step 6: Verify — re-read the vehicle
    try {
      const [updated] = await db
        .select()
        .from(vehicles)
        .where(eq(vehicles.id, vehicle.id))
        .limit(1);

      const saved = {
        brand: updated.brand,
        model: updated.model,
        modelYear: updated.modelYear,
        color: updated.color,
        fuelType: updated.fuelType,
        engineSizeCc: updated.engineSizeCc,
        powerKw: updated.powerKw,
        transmission: updated.transmission,
        driveType: updated.driveType,
        vin: updated.vin,
        engineCode: updated.engineCode,
        externalFetchedAt: updated.externalFetchedAt,
      };

      const hasData = updated.vin !== null || updated.fuelType !== null || updated.powerKw !== null;

      steps.push({
        step: "6. Verify saved data",
        status: hasData ? "✅ DATA PERSISTED" : "❌ DATA NOT PERSISTED",
        data: saved,
      });
    } catch (err: any) {
      steps.push({
        step: "6. Verify",
        status: "❌ READ ERROR",
        data: { error: err.message },
      });
    }

    return Response.json({ steps });
  } catch (err: any) {
    steps.push({
      step: "UNEXPECTED ERROR",
      status: "❌",
      data: { error: err.message, stack: err.stack?.split("\n").slice(0, 5) },
    });
    return Response.json({ steps }, { status: 500 });
  }
}
