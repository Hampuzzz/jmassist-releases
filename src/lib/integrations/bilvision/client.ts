import type { BilvisionVehicleData, MappedVehicleData } from "./types";

const BILVISION_BASE_URL = process.env.BILVISION_API_URL ?? "https://api.bilvision.se/v1";
const BILVISION_API_KEY = process.env.BILVISION_API_KEY;
const BILUPPGIFTER_API_KEY = process.env.BILUPPGIFTER_API_KEY;
const VEHICLE_LOOKUP_URL = process.env.VEHICLE_LOOKUP_URL ?? "http://localhost:8100";

/**
 * Fetches vehicle information by Swedish registration number.
 *
 * Provider priority:
 *   1. TypeScript scraper (car.info + biluppgifter.se — no external deps)
 *   2. Python Vehicle Lookup Service (if running on port 8100)
 *   3. Biluppgifter API (if BILUPPGIFTER_API_KEY is set)
 *   4. Bilvision API    (if BILVISION_API_KEY is set)
 *   5. Mock data        (development fallback)
 *
 * @param regNr - Swedish registration number e.g. "ABC123"
 * @returns Normalized vehicle data or null if not found
 */
export async function fetchVehicleByRegNr(
  regNr: string,
): Promise<BilvisionVehicleData | null> {
  const normalized = regNr.toUpperCase().replace(/[\s-]/g, "");

  // 1. Try TypeScript scraper first (car.info / biluppgifter.se — fast, no deps)
  try {
    const { scrapeVehicleData } = await import("../scraper");
    const scraped = await scrapeVehicleData(normalized);
    if (scraped) {
      console.log(`[vehicle] Got data from TS scraper (${scraped.source}) for ${normalized}`);
      return mapScrapedToBilvision(normalized, scraped);
    }
  } catch (e) {
    console.log("[vehicle] TS scraper failed, trying Python service:", (e as Error).message);
  }

  // 2. Try Python scraper service (car.info + biluppgifter.se via Playwright)
  try {
    const scraperResult = await fetchFromPythonService(normalized);
    if (scraperResult) return scraperResult;
  } catch (e) {
    console.log("[vehicle] Python lookup service unavailable, trying API fallbacks");
  }

  // 3. Try Biluppgifter API (paid)
  if (BILUPPGIFTER_API_KEY) {
    return fetchFromBiluppgifter(normalized);
  }

  // 4. Try Bilvision API
  if (BILVISION_API_KEY) {
    return fetchFromBilvision(normalized);
  }

  // 5. Fall back to mock data
  const { getMockVehicle } = await import("./mock");
  return getMockVehicle(normalized);
}

/**
 * Maps ScrapedVehicleData from the TS scraper → BilvisionVehicleData format.
 */
function mapScrapedToBilvision(
  regNr: string,
  scraped: import("../scraper").ScrapedVehicleData,
): BilvisionVehicleData {
  const fuelMap: Record<string, BilvisionVehicleData["fuelType"]> = {
    Petrol: "bensin", Bensin: "bensin", Gasoline: "bensin",
    Diesel: "diesel",
    Electric: "el", El: "el", Electricity: "el",
    Hybrid: "hybrid", Elhybrid: "hybrid",
    "Plug-in Hybrid": "laddhybrid", Laddhybrid: "laddhybrid", "Plug-in hybrid": "laddhybrid",
    Ethanol: "etanol", Etanol: "etanol", E85: "etanol",
    Gas: "gas", CNG: "gas", LPG: "gas", Naturgas: "gas",
  };

  const transmissionMap: Record<string, "manuell" | "automat"> = {
    Manuell: "manuell", Manual: "manuell",
    Automat: "automat", Automatic: "automat",
  };

  const driveMap: Record<string, "framhjulsdrift" | "bakhjulsdrift" | "fyrhjulsdrift"> = {
    Framhjulsdrift: "framhjulsdrift",
    Bakhjulsdrift: "bakhjulsdrift",
    Fyrhjulsdrift: "fyrhjulsdrift",
  };

  return {
    regNr,
    vin:                 scraped.vin ?? null,
    brand:               scraped.make ?? "Okänt",
    model:               scraped.model ?? "Okänd",
    modelYear:           scraped.year ?? 0,
    color:               scraped.color ?? null,
    colorCode:           null,
    fuelType:            fuelMap[scraped.fuelType ?? ""] ?? "okänd",
    engineSizeCC:        scraped.engineCc ?? null,
    powerKw:             scraped.powerKw ?? null,
    transmission:        transmissionMap[scraped.gearbox ?? ""] ?? null,
    driveType:           driveMap[scraped.driveType ?? ""] ?? null,
    firstRegisteredAt:   null,
    taxClass:            null,
    inspectionValidUntil: null,
    currentOwnerSince:   null,
    insuranceCompany:    null,
    _rawResponse:        scraped as unknown as Record<string, unknown>,
  };
}

/**
 * Fetch from the Python Vehicle Lookup Service (Playwright scrapers).
 * The service scrapes car.info, biluppgifter.se, and optionally transportstyrelsen.
 */
async function fetchFromPythonService(regNr: string): Promise<BilvisionVehicleData | null> {
  const response = await fetch(`${VEHICLE_LOOKUP_URL}/lookup/${regNr}`, {
    signal: AbortSignal.timeout(30_000), // scraping can take a while
  });

  if (!response.ok) return null;

  const json = await response.json();
  if (!json.success || !json.data) return null;

  const d = json.data;

  // Map Python service response → BilvisionVehicleData format
  const fuelMap: Record<string, BilvisionVehicleData["fuelType"]> = {
    "Bensin": "bensin", "Diesel": "diesel", "El": "el",
    "Hybrid": "hybrid", "Laddhybrid": "laddhybrid",
    "Etanol": "etanol", "Gas": "gas",
  };

  const transmissionMap: Record<string, "manuell" | "automat"> = {
    "Manuell": "manuell", "Automat": "automat",
  };

  const driveMap: Record<string, "framhjulsdrift" | "bakhjulsdrift" | "fyrhjulsdrift"> = {
    "Framhjulsdrift": "framhjulsdrift",
    "Bakhjulsdrift": "bakhjulsdrift",
    "Fyrhjulsdrift": "fyrhjulsdrift",
  };

  return {
    regNr,
    vin:                 d.vin ?? null,
    brand:               d.make ?? "Okänt",
    model:               d.model ?? "Okänd",
    modelYear:           d.year ?? 0,
    color:               d.color ?? null,
    colorCode:           null,
    fuelType:            fuelMap[d.fuel_type ?? ""] ?? "okänd",
    engineSizeCC:        d.engine_cc ?? null,
    powerKw:             d.power_kw ?? null,
    transmission:        transmissionMap[d.gearbox ?? ""] ?? null,
    driveType:           driveMap[d.drive_type ?? ""] ?? null,
    firstRegisteredAt:   d.first_registered ?? null,
    taxClass:            d.tax_class ?? null,
    inspectionValidUntil: d.inspection_valid_until ?? null,
    currentOwnerSince:   null,
    insuranceCompany:    null,
    _rawResponse:        d.raw_data ?? d,
  };
}

/**
 * Fetch from Biluppgifter.se API
 * Docs: https://apidocs.biluppgifter.se/
 * Endpoint: GET /api/v1/vehicle/regno/{regNr}
 */
async function fetchFromBiluppgifter(regNr: string): Promise<BilvisionVehicleData | null> {
  const response = await fetch(
    `https://api.biluppgifter.se/api/v1/vehicle/regno/${encodeURIComponent(regNr)}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${BILUPPGIFTER_API_KEY}`,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(10_000),
    },
  );

  if (response.status === 404) return null;

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Biluppgifter API ${response.status}: ${body}`);
  }

  const json = await response.json();
  const data = json.data ?? json;

  // Map Biluppgifter response to our normalized format
  return mapBiluppgifterResponse(regNr, data);
}

/**
 * Maps Biluppgifter API response to BilvisionVehicleData format
 */
function mapBiluppgifterResponse(regNr: string, data: any): BilvisionVehicleData {
  // Biluppgifter uses slightly different field names
  const fuelMap: Record<string, BilvisionVehicleData["fuelType"]> = {
    "Bensin":       "bensin",
    "Diesel":       "diesel",
    "El":           "el",
    "Elhybrid":     "hybrid",
    "Laddhybrid":   "laddhybrid",
    "Etanol":       "etanol",
    "Gas":          "gas",
  };

  const transmissionMap: Record<string, "manuell" | "automat"> = {
    "Manuell":   "manuell",
    "Automat":   "automat",
    "Automatisk": "automat",
  };

  const driveMap: Record<string, "framhjulsdrift" | "bakhjulsdrift" | "fyrhjulsdrift"> = {
    "Framhjulsdriven":  "framhjulsdrift",
    "Bakhjulsdriven":   "bakhjulsdrift",
    "Fyrhjulsdriven":   "fyrhjulsdrift",
  };

  return {
    regNr:               regNr,
    vin:                 data.vin ?? data.chassis_number ?? null,
    brand:               data.make ?? data.brand ?? "Okänt",
    model:               data.model ?? "Okänd",
    modelYear:           data.model_year ?? data.year ?? 0,
    color:               data.color ?? null,
    colorCode:           data.color_code ?? null,
    fuelType:            fuelMap[data.fuel_type ?? data.fuel] ?? "okänd",
    engineSizeCC:        data.engine_size_cc ?? data.displacement ?? null,
    powerKw:             data.power_kw ?? data.power ?? null,
    transmission:        transmissionMap[data.transmission ?? ""] ?? null,
    driveType:           driveMap[data.drive_type ?? ""] ?? null,
    firstRegisteredAt:   data.first_registered ?? data.first_registration_date ?? null,
    taxClass:            data.tax_class ?? data.vehicle_type ?? null,
    inspectionValidUntil: data.inspection_valid_until ?? data.next_inspection ?? null,
    currentOwnerSince:   data.current_owner_since ?? null,
    insuranceCompany:    data.insurance_company ?? null,
    _rawResponse:        data,
  };
}

/**
 * Fetch from Bilvision API
 */
async function fetchFromBilvision(regNr: string): Promise<BilvisionVehicleData | null> {
  const response = await fetch(
    `${BILVISION_BASE_URL}/vehicle/${encodeURIComponent(regNr)}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${BILVISION_API_KEY}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(10_000),
    },
  );

  if (response.status === 404) return null;

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Bilvision API ${response.status}: ${body}`);
  }

  const json = await response.json();
  if (!json.success || !json.data) return null;

  return json.data as BilvisionVehicleData;
}

/**
 * Maps Bilvision/Biluppgifter API response to our internal vehicle schema.
 */
export function mapBilvisionToVehicle(data: BilvisionVehicleData): MappedVehicleData {
  const fuelTypeMap: Record<BilvisionVehicleData["fuelType"], string> = {
    bensin:     "petrol",
    diesel:     "diesel",
    el:         "electric",
    hybrid:     "hybrid",
    laddhybrid: "plug_in_hybrid",
    etanol:     "ethanol",
    gas:        "lpg",
    okänd:      "other",
  };

  return {
    regNr:             data.regNr,
    vin:               data.vin ?? undefined,
    brand:             data.brand,
    model:             data.model,
    modelYear:         data.modelYear,
    color:             data.color ?? undefined,
    fuelType:          fuelTypeMap[data.fuelType] ?? "other",
    engineSizeCc:      data.engineSizeCC ?? undefined,
    powerKw:           data.powerKw ?? undefined,
    transmission:
      data.transmission === "manuell" ? "manual"
      : data.transmission === "automat" ? "automatic"
      : undefined,
    driveType:
      data.driveType === "framhjulsdrift" ? "fwd"
      : data.driveType === "bakhjulsdrift" ? "rwd"
      : data.driveType === "fyrhjulsdrift" ? "awd"
      : undefined,
    externalData:      data._rawResponse,
    externalFetchedAt: new Date(),
  };
}
