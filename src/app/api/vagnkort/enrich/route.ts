import { NextRequest } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { db } from "@/lib/db";
import { vehicles } from "@/lib/db/schemas";
import { eq, sql, and, or, isNull } from "drizzle-orm";

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
  // Direct pass-through for already-mapped values
  petrol: "petrol",
  electric: "electric",
  plug_in_hybrid: "plug_in_hybrid",
  lpg: "lpg",
  hydrogen: "hydrogen",
};

/**
 * GET /api/vagnkort/enrich
 * Returns current enrichment queue status.
 */
export async function GET() {
  const queue = await db
    .select({ id: vehicles.id, regNr: vehicles.regNr })
    .from(vehicles)
    .where(
      and(
        vehicles.isActive,
        or(
          isNull(vehicles.vin),
          eq(vehicles.brand, "Okänt"),
          isNull(vehicles.fuelType),
          isNull(vehicles.powerKw),
          isNull(vehicles.mileageKm),
          isNull(vehicles.engineCode),
          isNull(vehicles.engineSizeCc),
        ),
      ),
    );

  return new Response(
    JSON.stringify({ total: queue.length, vehicles: queue.map((v) => v.regNr) }),
    { headers: { "Content-Type": "application/json" } },
  );
}

/**
 * POST /api/vagnkort/enrich
 * Starts background vehicle enrichment via Server-Sent Events (SSE).
 * Iterates vehicles with missing data, calls the lookup service,
 * and updates the DB. Streams progress to the client.
 *
 * Query params:
 *   ?priority=ABC123  — put this regNr first in queue
 */
export async function POST(request: NextRequest) {
  const supabase = createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const priorityRegNr = request.nextUrl.searchParams
    .get("priority")
    ?.toUpperCase()
    .replace(/[\s-]/g, "");

  // Find vehicles that need enrichment (missing key technical data)
  // Include vehicles missing ANY important field: VIN, brand, fuel, power, mileage, engine code, engine cc
  const queue = await db
    .select({
      id: vehicles.id,
      regNr: vehicles.regNr,
      brand: vehicles.brand,
      model: vehicles.model,
    })
    .from(vehicles)
    .where(
      and(
        vehicles.isActive,
        or(
          isNull(vehicles.vin),
          eq(vehicles.brand, "Okänt"),
          isNull(vehicles.fuelType),
          isNull(vehicles.powerKw),
          isNull(vehicles.mileageKm),
          isNull(vehicles.engineCode),
          isNull(vehicles.engineSizeCc),
        ),
      ),
    );

  if (queue.length === 0) {
    return new Response(
      JSON.stringify({ message: "Alla fordon har redan komplett data." }),
      { headers: { "Content-Type": "application/json" } },
    );
  }

  // Sort: priority vehicle first if specified
  if (priorityRegNr) {
    queue.sort((a, b) => {
      if (a.regNr === priorityRegNr) return -1;
      if (b.regNr === priorityRegNr) return 1;
      return 0;
    });
  }

  // Check if lookup service is available
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
    return new Response(
      JSON.stringify({
        error: "Fordonsuppslagningstjänsten körs inte. Starta den med: node scripts/vehicle-lookup-service.mjs",
      }),
      { status: 503, headers: { "Content-Type": "application/json" } },
    );
  }

  // SSE stream for progress
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      function send(data: Record<string, unknown>) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(data)}\n\n`),
        );
      }

      send({
        type: "start",
        total: queue.length,
        message: `Startar berikning av ${queue.length} fordon...`,
      });

      let completed = 0;
      let errors = 0;
      let enriched = 0;

      for (const vehicle of queue) {
        try {
          // Skip and delete obviously invalid reg numbers (e.g. "?????", "XXX", too short)
          const regClean = (vehicle.regNr ?? "").replace(/[^A-Za-z0-9]/g, "");
          if (regClean.length < 4 || /^[?*]+$/.test(vehicle.regNr ?? "")) {
            console.log(`[enrich] 🗑️ Invalid regNr "${vehicle.regNr}" — DELETING from DB`);
            try {
              await db.delete(vehicles).where(eq(vehicles.id, vehicle.id));
              enriched++;
              send({
                type: "enriched",
                regNr: vehicle.regNr,
                completed,
                total: queue.length,
                enriched,
                errors,
                message: `🗑️ ${vehicle.regNr} — Ogiltigt reg.nr — raderad`,
              });
            } catch (dbErr: any) {
              errors++;
            }
            completed++;
            continue;
          }

          send({
            type: "progress",
            regNr: vehicle.regNr,
            brand: vehicle.brand,
            model: vehicle.model,
            completed,
            total: queue.length,
            enriched,
            errors,
            message: `Söker ${vehicle.regNr}... (${completed + 1}/${queue.length})`,
          });

          // Call lookup service
          const res = await fetch(
            `${VEHICLE_LOOKUP_URL}/lookup/${vehicle.regNr}`,
            { signal: AbortSignal.timeout(30_000) },
          );

          if (!res.ok) {
            // 404 = vehicle not found in registry → delete it
            if (res.status === 404) {
              console.log(`[enrich] 🗑️ HTTP 404 for ${vehicle.regNr} — DELETING from DB`);
              try {
                await db.delete(vehicles).where(eq(vehicles.id, vehicle.id));
                enriched++;
                send({
                  type: "enriched",
                  regNr: vehicle.regNr,
                  brand: vehicle.brand,
                  model: vehicle.model,
                  completed,
                  total: queue.length,
                  enriched,
                  errors,
                  message: `🗑️ ${vehicle.regNr} — Ej i register — raderad`,
                });
              } catch (dbErr: any) {
                console.error(`[enrich] ❌ DB error deleting ${vehicle.regNr}:`, dbErr.message);
                errors++;
              }
            } else {
              errors++;
              console.error(`[enrich] ❌ Lookup HTTP ${res.status} for ${vehicle.regNr}`);
              send({
                type: "error",
                regNr: vehicle.regNr,
                message: `Uppslagstjänsten svarade HTTP ${res.status}`,
                completed,
                total: queue.length,
                enriched,
                errors,
              });
            }
          } else {
            const json = await res.json();

            if (json.success && json.data) {
              const data = json.data;

              console.log(`[enrich] Raw data for ${vehicle.regNr}:`, JSON.stringify(data));

              // ── Check if vehicle is scrapped/exported/deregistered → DELETE it ──
              const INACTIVE_STATUSES = new Set(["scrapped", "exported", "deregistered", "stolen"]);
              if (data.vehicle_status && INACTIVE_STATUSES.has(data.vehicle_status)) {
                const statusLabel = data.vehicle_status === "scrapped" ? "SKROTAD" : data.vehicle_status === "exported" ? "EXPORTERAD" : data.vehicle_status === "deregistered" ? "AVREGISTRERAD" : "STULEN";
                console.log(`[enrich] 🗑️ ${vehicle.regNr} is ${data.vehicle_status} — DELETING from DB`);
                try {
                  await db
                    .delete(vehicles)
                    .where(eq(vehicles.id, vehicle.id));

                  send({
                    type: "enriched",
                    regNr: vehicle.regNr,
                    brand: data.make ?? vehicle.brand,
                    model: data.model ?? vehicle.model,
                    completed,
                    total: queue.length,
                    enriched,
                    errors,
                    message: `🗑️ ${vehicle.regNr} — ${statusLabel} — raderad`,
                  });
                  enriched++;
                } catch (dbErr: any) {
                  console.error(`[enrich] ❌ DB error deleting ${vehicle.regNr}:`, dbErr.message);
                  errors++;
                }
                completed++;
                continue;
              }

              // Map fuel type
              const rawFuel = (data.fuel_type ?? "").toLowerCase();
              const mappedFuel = FUEL_MAP[rawFuel] ?? null;

              // Build update object — count actual data fields separately
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
                  updateFields.powerHp = Math.round(kw * 1.341);
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
              const JUNK_ENGINE_CODES = new Set(["logga in", "login", "visa", "dölj", "premium", "pro", "köp", "nedc", "wltp", "euro 5", "euro 6", "euro 4", "hämta", "hamta", "hämta motorkod", "hamta motorkod", "okänt", "okänd", "okant", "okand", "unknown", "saknas", "missing", "n/a"]);
              if (data.engine_code && typeof data.engine_code === "string" &&
                  !JUNK_ENGINE_CODES.has(data.engine_code.toLowerCase().trim()) &&
                  !/^(hämta|hamta|visa|logga|köp|dölj)/i.test(data.engine_code.trim())) {
                updateFields.engineCode = data.engine_code;
                dataFieldCount++;
              }
              if (data.mileage_km) {
                const km = typeof data.mileage_km === "string" ? parseInt(data.mileage_km, 10) : data.mileage_km;
                if (!isNaN(km) && km > 0 && km < 2_000_000) {
                  updateFields.mileageKm = km;
                  updateFields.mileageUpdatedAt = new Date();
                  dataFieldCount++;
                }
              }

              // Only save if we got at least 1 actual data field
              if (dataFieldCount > 0) {
                // Add metadata fields
                updateFields.externalData = data;
                updateFields.externalFetchedAt = new Date();
                updateFields.updatedAt = new Date();

                try {
                  const updateResult = await db
                    .update(vehicles)
                    .set(updateFields)
                    .where(eq(vehicles.id, vehicle.id))
                    .returning({ id: vehicles.id });

                  if (updateResult.length === 0) {
                    console.error(`[enrich] ❌ UPDATE returned 0 rows for ${vehicle.regNr} (id: ${vehicle.id})`);
                    errors++;
                    send({
                      type: "error",
                      regNr: vehicle.regNr,
                      message: `Uppdatering påverkade 0 rader — kontrollera vehicle ID`,
                    });
                  } else {
                    enriched++;
                    console.log(`[enrich] ✅ Saved ${vehicle.regNr}: ${dataFieldCount} fields updated, rows: ${updateResult.length}`);

                    send({
                      type: "enriched",
                      regNr: vehicle.regNr,
                      brand: data.make ?? vehicle.brand,
                      model: data.model ?? vehicle.model,
                      year: data.year ?? null,
                      fuel: data.fuel_type ?? null,
                      engineCode: data.engine_code ?? null,
                      completed,
                      total: queue.length,
                      enriched,
                      errors,
                      message: `✅ ${vehicle.regNr} — ${data.make ?? ""} ${data.model ?? ""}`,
                    });
                  }
                } catch (dbErr: any) {
                  console.error(`[enrich] ❌ DB error saving ${vehicle.regNr}:`, dbErr.message);
                  console.error(`[enrich] Update fields were:`, JSON.stringify(updateFields, null, 2));
                  errors++;
                  send({
                    type: "error",
                    regNr: vehicle.regNr,
                    message: `DB-fel vid sparning: ${dbErr.message}`,
                  });
                }
              } else {
                console.log(`[enrich] ⚠️ No usable data fields for ${vehicle.regNr}, skipping save`);
              }
            } else if (json.captcha_required) {
              send({
                type: "captcha",
                regNr: vehicle.regNr,
                message: `CAPTCHA krävs för ${vehicle.regNr} — hoppar över.`,
              });
            } else {
              // Lookup returned success:false or no data → vehicle not in any registry → DELETE it
              console.log(`[enrich] 🗑️ No data found for ${vehicle.regNr} — DELETING from DB`);
              try {
                await db
                  .delete(vehicles)
                  .where(eq(vehicles.id, vehicle.id));

                enriched++;
                send({
                  type: "enriched",
                  regNr: vehicle.regNr,
                  brand: vehicle.brand,
                  model: vehicle.model,
                  completed,
                  total: queue.length,
                  enriched,
                  errors,
                  message: `🗑️ ${vehicle.regNr} — Ej i register — raderad`,
                });
              } catch (dbErr: any) {
                console.error(`[enrich] ❌ DB error deleting ${vehicle.regNr}:`, dbErr.message);
                errors++;
                send({
                  type: "error",
                  regNr: vehicle.regNr,
                  message: `DB-fel vid radering: ${dbErr.message}`,
                  completed,
                  total: queue.length,
                  enriched,
                  errors,
                });
              }
            }
          }
        } catch (err: any) {
          errors++;
          send({
            type: "error",
            regNr: vehicle.regNr,
            message: `Fel vid ${vehicle.regNr}: ${err.message}`,
          });
        }

        completed++;

        // Random delay 5-15 seconds to avoid being blocked
        if (completed < queue.length) {
          const delayMs = Math.floor(Math.random() * 10_000) + 5_000;
          send({
            type: "waiting",
            completed,
            total: queue.length,
            enriched,
            errors,
            delayMs,
            message: `Väntar ${(delayMs / 1000).toFixed(0)}s... (${completed}/${queue.length} klara)`,
          });
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
      }

      send({
        type: "done",
        completed,
        total: queue.length,
        enriched,
        errors,
        message: `Klar! ${enriched} fordon berikade, ${errors} fel.`,
      });

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
