/**
 * Server-side vehicle data scraper for Swedish sites.
 * No Python/Playwright needed — uses plain fetch + HTML parsing.
 *
 * Sources:
 * 1. car.info/en-se/license-plate/S/{REG} — comprehensive, rarely blocks
 * 2. biluppgifter.se/fordon/{REG} — backup source (often blocked by Cloudflare)
 *
 * car.info HTML structure (as of 2026-02):
 *   <h1>S{REG}{Make} {Model} {extras}, {HP}hp, {Year}</h1>
 *   Spec rows: <span class="sptitle ast-i">{Label}</span>
 *              <span class="ast-i">{Value}</span>
 *   Labels: Power, Horsepower, Displacement, Transmission, Drivetrain,
 *           Fuel, Colour, Curb Weight, Gross Weight, etc.
 *   VIN requires login (not available without auth).
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ScrapedVehicleData {
  regNr: string;
  make: string | null;
  model: string | null;
  year: number | null;
  color: string | null;
  fuelType: string | null;
  gearbox: string | null;
  driveType: string | null;
  engineCc: number | null;
  powerKw: number | null;
  vin: string | null;
  source: "car.info" | "biluppgifter.se";
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CAR_INFO_BASE = "https://www.car.info/en-se/license-plate/S";

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const TIMEOUT_MS = 10_000;

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Scrape vehicle data for a Swedish registration number.
 * Tries car.info first, then biluppgifter.se as backup.
 *
 * @param regNr  Swedish registration number (e.g. "ABC123")
 * @returns Normalized vehicle data or null if not found / error
 */
export async function scrapeVehicleData(
  regNr: string,
): Promise<ScrapedVehicleData | null> {
  const normalized = regNr.toUpperCase().replace(/[\s-]/g, "");

  if (!normalized || normalized.length < 2) return null;

  // Try car.info first
  try {
    const result = await scrapeCarInfo(normalized);
    if (result) return result;
  } catch (err) {
    console.warn(
      "[scraper] car.info failed for",
      normalized,
      "—",
      (err as Error).message,
    );
  }

  // Try biluppgifter.se as backup
  try {
    const result = await scrapeBiluppgifter(normalized);
    if (result) return result;
  } catch (err) {
    console.warn(
      "[scraper] biluppgifter.se failed for",
      normalized,
      "—",
      (err as Error).message,
    );
  }

  return null;
}

// ---------------------------------------------------------------------------
// car.info scraper
// ---------------------------------------------------------------------------

async function scrapeCarInfo(
  regNr: string,
): Promise<ScrapedVehicleData | null> {
  const url = `${CAR_INFO_BASE}/${encodeURIComponent(regNr)}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "User-Agent": USER_AGENT,
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-SE,en;q=0.9,sv;q=0.8",
      "Cache-Control": "no-cache",
    },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    redirect: "follow",
  });

  if (!response.ok) {
    if (response.status === 404) return null;
    console.warn(`[scraper] car.info returned ${response.status} for ${regNr}`);
    return null;
  }

  const html = await response.text();

  // Detect DataDome / CAPTCHA blocks
  if (
    html.includes("datadome") ||
    html.includes("captcha") ||
    html.includes("blocked")
  ) {
    console.warn("[scraper] car.info returned a CAPTCHA/block page for", regNr);
    return null;
  }

  // If page is too short it's probably an error page
  if (html.length < 2000) {
    return null;
  }

  return parseCarInfoHtml(regNr, html);
}

/**
 * Parse the car.info HTML page into a ScrapedVehicleData object.
 *
 * HTML structure:
 *   <h1>S{REG}{Make} {Model} {details}, {HP}hp, {Year}</h1>
 *   Spec rows follow the pattern:
 *     <span class="sptitle ast-i">{Label}</span>
 *     <span class="ast-i">{Value}</span>
 */
function parseCarInfoHtml(
  regNr: string,
  html: string,
): ScrapedVehicleData | null {
  // --- Extract title from <h1> ---
  // The h1 contains something like:
  //   "SHFR403Honda Powersports Z50A 0.05 Semi-Automatic, 4hp, 1974"
  // The reg nr prefix ("S" + plate) precedes the make/model/year info
  const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const h1Text = h1Match ? stripHtml(h1Match[1]) : "";

  let make: string | null = null;
  let model: string | null = null;
  let year: number | null = null;

  if (h1Text) {
    // Remove the plate prefix: "S" + regNr
    // The h1 text is like "SABC123Volvo V70 2.4 Automatic, 170hp, 2005"
    const platePrefix = `S${regNr}`;
    let titlePart = h1Text;
    const prefixIdx = titlePart.indexOf(platePrefix);
    if (prefixIdx !== -1) {
      titlePart = titlePart.substring(prefixIdx + platePrefix.length).trim();
    } else {
      // Try just removing the reg number if the S prefix isn't there
      const regIdx = titlePart.indexOf(regNr);
      if (regIdx !== -1) {
        titlePart = titlePart.substring(regIdx + regNr.length).trim();
      }
    }

    // Extract year from the end — pattern: ", {YEAR}" at the end
    const yearMatch = titlePart.match(/,\s*(\d{4})\s*$/);
    if (yearMatch) {
      year = parseInt(yearMatch[1], 10);
      titlePart = titlePart.substring(0, yearMatch.index).trim();
    }

    // The remaining titlePart is "{Make} {Model} {engine} {extras}, {HP}hp"
    // Remove trailing ", NNhp" or ", NNNhp"
    const hpMatch = titlePart.match(/,\s*\d+hp\s*$/i);
    if (hpMatch) {
      titlePart = titlePart.substring(0, hpMatch.index).trim();
    }

    // Now titlePart should be like "Volvo V70 2.4 Automatic" or "BMW 320d Touring"
    // The first word is the make, the rest is model
    const parts = titlePart.split(/\s+/);
    if (parts.length >= 1) {
      // Handle multi-word makes like "Honda Powersports", "Mercedes-Benz"
      // Simple heuristic: first word is make unless it's clearly multi-word
      const knownMultiWordMakes: Record<string, boolean> = {
        alfa: true, // Alfa Romeo
        aston: true, // Aston Martin
        land: true, // Land Rover
        rolls: true, // Rolls-Royce
        honda: false, // Honda (Powersports is a sub-brand)
      };

      make = parts[0];
      let modelStart = 1;

      // Check for known two-word makes
      if (parts.length >= 2) {
        const firstLower = parts[0].toLowerCase();
        if (knownMultiWordMakes[firstLower]) {
          make = `${parts[0]} ${parts[1]}`;
          modelStart = 2;
        }
        // Handle "Mercedes-Benz" (hyphenated, already one word)
      }

      model = parts.slice(modelStart).join(" ") || null;
    }
  }

  // --- Extract specification rows ---
  // Pattern: <span class="sptitle ast-i">{Label}</span> ... <span class="ast-i">{Value}</span>
  // We extract all label-value pairs
  const specs = extractSpecRows(html);

  // --- Map specification labels to fields ---
  const fuelType = specs["Fuel"] ?? specs["Fuel type"] ?? null;
  const gearbox = normalizeGearbox(specs["Transmission"] ?? null);
  const driveType = normalizeDriveType(specs["Drivetrain"] ?? null);
  const color = specs["Colour"] ?? specs["Color"] ?? null;
  const powerKw = parseKw(specs["Power"] ?? null);
  const engineCc = parseCc(specs["Displacement"] ?? specs["Engine size"] ?? null);

  // VIN is typically behind a login wall on car.info
  // but try to extract it in case it's ever visible
  const vin = extractVin(html);

  // If we couldn't get even the make, the page probably didn't have real data
  if (!make && !fuelType && !color) {
    return null;
  }

  return {
    regNr,
    make,
    model,
    year,
    color,
    fuelType,
    gearbox,
    driveType,
    engineCc,
    powerKw,
    vin,
    source: "car.info",
  };
}

// ---------------------------------------------------------------------------
// biluppgifter.se scraper (backup — often blocked by Cloudflare)
// ---------------------------------------------------------------------------

async function scrapeBiluppgifter(
  regNr: string,
): Promise<ScrapedVehicleData | null> {
  const url = `https://biluppgifter.se/fordon/${encodeURIComponent(regNr)}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      "User-Agent": USER_AGENT,
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "sv-SE,sv;q=0.9,en;q=0.8",
      "Cache-Control": "no-cache",
    },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    redirect: "follow",
  });

  if (!response.ok) {
    if (response.status === 404) return null;
    // biluppgifter.se often returns 403 (Cloudflare)
    if (response.status === 403) return null;
    console.warn(
      `[scraper] biluppgifter.se returned ${response.status} for ${regNr}`,
    );
    return null;
  }

  const html = await response.text();

  // Detect Cloudflare challenge
  if (
    html.includes("cf-browser-verification") ||
    html.includes("challenge-platform") ||
    html.includes("Checking your browser")
  ) {
    console.warn(
      "[scraper] biluppgifter.se returned a Cloudflare challenge for",
      regNr,
    );
    return null;
  }

  if (html.length < 2000) return null;

  return parseBiluppgifterHtml(regNr, html);
}

/**
 * Parse biluppgifter.se HTML.
 *
 * The page uses a different structure with Swedish labels:
 *   <dt>Märke</dt><dd>Volvo</dd>
 *   <dt>Modell</dt><dd>V70</dd>
 * etc. Also has divs with specific class patterns.
 */
function parseBiluppgifterHtml(
  regNr: string,
  html: string,
): ScrapedVehicleData | null {
  // Try to extract dt/dd pairs (biluppgifter uses definition lists)
  const dtDdPairs = extractDtDd(html);

  // Also try key-value div patterns
  const specs = extractSpecRows(html);

  // Merge both sources
  const allData: Record<string, string> = { ...dtDdPairs, ...specs };

  const make =
    allData["Märke"] ?? allData["Make"] ?? allData["Fabrikat"] ?? null;
  const model =
    allData["Modell"] ?? allData["Model"] ?? allData["Handelsbenämning"] ?? null;
  const yearStr =
    allData["Årsmodell"] ??
    allData["Modellår"] ??
    allData["Year"] ??
    allData["Model year"] ??
    null;
  const year = yearStr ? parseInt(yearStr, 10) || null : null;

  const color =
    allData["Färg"] ?? allData["Colour"] ?? allData["Color"] ?? null;
  const fuelType =
    allData["Drivmedel"] ?? allData["Bränsle"] ?? allData["Fuel"] ?? null;
  const gearbox = normalizeGearbox(
    allData["Växellåda"] ?? allData["Transmission"] ?? null,
  );
  const driveType = normalizeDriveType(
    allData["Drivning"] ?? allData["Drivetrain"] ?? null,
  );
  const powerKw = parseKw(
    allData["Effekt"] ?? allData["Power"] ?? null,
  );
  const engineCc = parseCc(
    allData["Slagvolym"] ?? allData["Displacement"] ?? null,
  );

  // biluppgifter.se sometimes shows VIN publicly
  const vin =
    allData["Chassinummer"] ??
    allData["VIN"] ??
    extractVin(html) ??
    null;

  if (!make && !model && !fuelType) return null;

  return {
    regNr,
    make,
    model,
    year,
    color,
    fuelType,
    gearbox,
    driveType,
    engineCc,
    powerKw,
    vin,
    source: "biluppgifter.se",
  };
}

// ---------------------------------------------------------------------------
// HTML parsing helpers (regex-based — no cheerio dependency)
// ---------------------------------------------------------------------------

/**
 * Extract specification rows from car.info HTML.
 * Pattern: <span class="sptitle ...">Label</span> ... <span class="ast-i">Value</span>
 *
 * We look for consecutive sptitle + value spans within the same context.
 */
function extractSpecRows(html: string): Record<string, string> {
  const result: Record<string, string> = {};

  // Strategy 1: Match sptitle/value pairs
  // The pattern on car.info is:
  //   <span class="sptitle ast-i">Label</span>
  //   <span class="ast-i">Value</span>
  // These appear close together in the HTML.
  const sptitleRegex =
    /<span[^>]*class="[^"]*sptitle[^"]*"[^>]*>([\s\S]*?)<\/span>\s*<span[^>]*class="[^"]*ast-i[^"]*"[^>]*>([\s\S]*?)<\/span>/gi;

  let match: RegExpExecArray | null;
  while ((match = sptitleRegex.exec(html)) !== null) {
    const label = stripHtml(match[1]).trim();
    const value = stripHtml(match[2]).trim();
    if (label && value && value !== "—" && value !== "-" && value !== "[Login]") {
      result[label] = value;
    }
  }

  // Strategy 2: Also look for broader patterns where sptitle and value
  // might have elements between them (some spec rows have icons etc.)
  if (Object.keys(result).length === 0) {
    const labels: Array<{ label: string; index: number }> = [];
    const labelRegex =
      /<span[^>]*class="[^"]*sptitle[^"]*"[^>]*>([\s\S]*?)<\/span>/gi;
    while ((match = labelRegex.exec(html)) !== null) {
      labels.push({ label: stripHtml(match[1]).trim(), index: match.index });
    }

    // For each label, find the next non-sptitle ast-i span
    for (const { label, index } of labels) {
      if (!label) continue;
      const afterLabel = html.substring(index + 50, index + 500);
      const valueMatch = afterLabel.match(
        /<span[^>]*class="(?![^"]*sptitle)[^"]*ast-i[^"]*"[^>]*>([\s\S]*?)<\/span>/i,
      );
      if (valueMatch) {
        const value = stripHtml(valueMatch[1]).trim();
        if (value && value !== "—" && value !== "-" && value !== "[Login]") {
          result[label] = value;
        }
      }
    }
  }

  return result;
}

/**
 * Extract <dt>/<dd> pairs from HTML (used by biluppgifter.se).
 */
function extractDtDd(html: string): Record<string, string> {
  const result: Record<string, string> = {};

  const dtDdRegex =
    /<dt[^>]*>([\s\S]*?)<\/dt>\s*<dd[^>]*>([\s\S]*?)<\/dd>/gi;
  let match: RegExpExecArray | null;
  while ((match = dtDdRegex.exec(html)) !== null) {
    const label = stripHtml(match[1]).trim();
    const value = stripHtml(match[2]).trim();
    if (label && value && value !== "—" && value !== "-") {
      result[label] = value;
    }
  }

  return result;
}

/**
 * Try to extract VIN from HTML.
 * VIN is a 17-character alphanumeric code (no I, O, Q).
 */
function extractVin(html: string): string | null {
  // Look for labeled VIN fields
  const vinLabelPatterns = [
    /VIN[:\s]*<[^>]*>([A-HJ-NPR-Z0-9]{17})<\/[^>]+>/i,
    /chassi(?:nummer)?[:\s]*<[^>]*>([A-HJ-NPR-Z0-9]{17})<\/[^>]+>/i,
    /vin["']?\s*:\s*["']([A-HJ-NPR-Z0-9]{17})["']/i,
  ];

  for (const pattern of vinLabelPatterns) {
    const match = html.match(pattern);
    if (match) return match[1];
  }

  // Last resort: look for standalone 17-char VIN patterns near "VIN" or "chassi" context
  const vinContext = html.match(
    /(?:VIN|chassi)[^<]{0,100}([A-HJ-NPR-Z0-9]{17})/i,
  );
  if (vinContext) return vinContext[1];

  return null;
}

// ---------------------------------------------------------------------------
// Normalization helpers
// ---------------------------------------------------------------------------

/** Strip HTML tags from a string */
function stripHtml(s: string): string {
  return s
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&nbsp;/g, " ")
    .trim();
}

/**
 * Parse power in kW from strings like "3 kW", "110 kW (150 hp)", etc.
 */
function parseKw(raw: string | null): number | null {
  if (!raw) return null;
  const match = raw.match(/(\d+)\s*kW/i);
  if (match) return parseInt(match[1], 10);

  // If only hp is available, convert: 1 hp ~= 0.7457 kW
  const hpMatch = raw.match(/(\d+)\s*(?:hp|hk)/i);
  if (hpMatch) return Math.round(parseInt(hpMatch[1], 10) * 0.7457);

  return null;
}

/**
 * Parse engine displacement from strings like "49 cc / 0.05 l",
 * "1968 cc", "2.0 l", etc.
 */
function parseCc(raw: string | null): number | null {
  if (!raw) return null;

  // Try cc directly: "1968 cc", "49 cc"
  const ccMatch = raw.match(/([\d,. ]+)\s*cc/i);
  if (ccMatch) {
    const val = parseFloat(ccMatch[1].replace(/[\s,]/g, ""));
    if (!isNaN(val)) return Math.round(val);
  }

  // Try liters: "2.0 l", "0.05 l" → convert to cc
  const literMatch = raw.match(/([\d,.]+)\s*l(?:iter|itre)?/i);
  if (literMatch) {
    const val = parseFloat(literMatch[1].replace(",", "."));
    if (!isNaN(val) && val > 0) return Math.round(val * 1000);
  }

  return null;
}

/**
 * Normalize gearbox/transmission string to a consistent value.
 * Input examples: "Automatic (Semi-automatic), 3-speed",
 *                 "Manual, 5-speed", "Automat", "Manuell"
 */
function normalizeGearbox(raw: string | null): string | null {
  if (!raw) return null;
  const lower = raw.toLowerCase();

  if (lower.includes("automat") || lower.includes("automatic") || lower.includes("cvt") || lower.includes("dct")) {
    return "Automat";
  }
  if (lower.includes("manuell") || lower.includes("manual")) {
    return "Manuell";
  }

  // Return the raw value if we can't normalize
  return raw;
}

/**
 * Normalize drivetrain string.
 * Input examples: "Two Wheel Drive", "Front Wheel Drive",
 *                 "All Wheel Drive", "Rear Wheel Drive",
 *                 "Framhjulsdrift", "Bakhjulsdrift", "Fyrhjulsdrift"
 */
function normalizeDriveType(raw: string | null): string | null {
  if (!raw) return null;
  const lower = raw.toLowerCase();

  if (lower.includes("front") || lower.includes("framhjul") || lower.includes("fwd")) {
    return "Framhjulsdrift";
  }
  if (lower.includes("rear") || lower.includes("bakhjul") || lower.includes("rwd")) {
    return "Bakhjulsdrift";
  }
  if (
    lower.includes("all wheel") ||
    lower.includes("4wd") ||
    lower.includes("awd") ||
    lower.includes("fyrhjul") ||
    lower.includes("four wheel")
  ) {
    return "Fyrhjulsdrift";
  }
  if (lower.includes("two wheel")) {
    // "Two Wheel Drive" is ambiguous — could be FWD or RWD.
    // For Swedish cars it's most commonly FWD.
    return "Framhjulsdrift";
  }

  return raw;
}
