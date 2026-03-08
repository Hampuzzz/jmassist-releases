#!/usr/bin/env node
/**
 * JM Assist — Deep Vehicle Lookup Service v2
 *
 * A headless-browser scraper on port 8100 that extracts vehicle data
 * from Swedish public registries using advanced techniques:
 *
 *   1. Request Interception — blocks images/CSS/fonts, captures JSON payloads
 *   2. JSON Data-Mining — reads __NEXT_DATA__, __INITIAL_STATE__ from page
 *   3. Engine Code Extraction — finds motor codes (D4204T14, B5244S, etc.)
 *   4. UA Rotation + Block Detection — rotates User-Agent on 403/429
 *   5. Clean API Output — { success, data: { regNo, vin, engineCode, ... } }
 *
 * Sources (priority order):
 *   1. biluppgifter.se — primary (Cloudflare-protected, Playwright handles it)
 *   2. car.info — backup (rate-limited, Coffee break detection)
 *
 * Usage:
 *   node scripts/vehicle-lookup-service.mjs
 *
 * Endpoints:
 *   GET  /health           → { status: "ok", browser: bool }
 *   GET  /lookup/:regNr    → { success, data: { ... } }
 */

import http from "node:http";
import fs from "node:fs";
import path_module from "node:path";
import { chromium } from "playwright";

// ═══════════════════════════════════════════════════════════════════════════
// Cookie Storage — car.info login session
// ═══════════════════════════════════════════════════════════════════════════

const CARINFO_COOKIE_FILE = path_module.join(process.cwd(), "data", "carinfo-cookies.json");

function loadCarInfoCookies() {
  try {
    if (fs.existsSync(CARINFO_COOKIE_FILE)) {
      const cookies = JSON.parse(fs.readFileSync(CARINFO_COOKIE_FILE, "utf-8"));
      console.log(`[cookies] Loaded ${cookies.length} car.info cookies`);
      return cookies;
    }
  } catch { /* no cookies */ }
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════
// Configuration
// ═══════════════════════════════════════════════════════════════════════════

const PORT = parseInt(process.env.VEHICLE_LOOKUP_PORT ?? "8100", 10);
const HEADLESS = process.env.HEADLESS !== "false";
const TIMEOUT_MS = 25_000;
const BROWSER_REUSE_MS = 5 * 60 * 1000;

// ═══════════════════════════════════════════════════════════════════════════
// User-Agent Rotation Pool
// ═══════════════════════════════════════════════════════════════════════════

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:133.0) Gecko/20100101 Firefox/133.0",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Safari/605.1.15",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36 Edg/129.0.0.0",
  "Mozilla/5.0 (X11; Linux x86_64; rv:133.0) Gecko/20100101 Firefox/133.0",
];

let uaIndex = Math.floor(Math.random() * USER_AGENTS.length);

function getNextUA() {
  const ua = USER_AGENTS[uaIndex % USER_AGENTS.length];
  uaIndex++;
  return ua;
}

// Track blocked status per source
let biluppgifterBlocked = 0; // timestamp when blocked, 0 = not blocked
let carInfoBlocked = 0;
const BLOCK_COOLDOWN_MS = 5 * 60 * 1000; // 5 min cooldown after block

// ═══════════════════════════════════════════════════════════════════════════
// Engine Code Patterns
// ═══════════════════════════════════════════════════════════════════════════

// Swedish/European engine code patterns:
// Volvo: D4204T14, D5244T, B4204T, D4162T, B5254T
// BMW: N47D20, B47D20, N20B20, S55B30, B58B30
// VW/Audi: CJSA, CZDA, DFGA, EA888
// Mercedes: OM654, M274, M276
// Ford: UFDA, T7CJ, XWDA
// Peugeot/Citroën: DV6TED4, EB2DT
// Toyota: 2ZR-FXE, 1NR-FE
const ENGINE_CODE_PATTERNS = [
  // Volvo pattern: letter + 4 digits + optional T + optional digits
  /\b([BD]\d{4}[A-Z](?:\d{1,2})?)\b/,
  // BMW pattern: letter(s) + 2 digits + letter + 2 digits
  /\b([NBMS]\d{2}[A-Z]\d{2})\b/,
  // BMW newer: letter + 2 digits + letter + 2 digits + letter?
  /\b([A-Z]\d{2}[A-Z]\d{2}[A-Z]?)\b/,
  // VW/Audi 4-letter codes (all caps, no numbers in middle)
  /\b([A-Z]{4})\b/,
  // Mercedes OM + 3 digits
  /\b(OM\d{3}(?:\s?DE\s?\d{2})?)\b/,
  // Mercedes M + 3 digits
  /\b(M\d{3}(?:\s?DE\s?\d{2})?)\b/,
  // Toyota pattern: digit + letter(s) + digit(s) + hyphen + letters
  /\b(\d[A-Z]{1,3}-?[A-Z]{1,3}(?:\d{1,2})?)\b/,
  // General: 1-2 letters + 3-4 digits + 1-3 letters + optional digits
  /\b([A-Z]{1,2}\d{3,4}[A-Z]{1,3}\d{0,2})\b/,
];

// Words that look like engine codes but aren't
const ENGINE_CODE_BLACKLIST = new Set([
  "VISA", "IBAB", "EDIT", "EURO", "AUTO", "TEXT", "INFO", "FINN",
  "TILL", "FRÅN", "LOAD", "MENU", "NEXT", "PREV", "HOME", "BACK",
  "LINK", "FORM", "HTML", "BODY", "HEAD", "META", "TYPE", "NAME",
  "DATA", "HTTP", "ICON", "FILE", "FONT", "SIZE", "BOLD", "SLIM",
  "FLEX", "GRID", "NONE", "TRUE", "NULL", "VOID", "THIS", "SELF",
  "NEDC", "WLTP", "CAFE",
]);

function extractEngineCode(text) {
  if (!text) return null;

  // First look for explicit labels
  const labelPatterns = [
    /(?:motorkod|motor\s*kod|engine\s*code|motortyp)[:\s]+([A-Z0-9][A-Z0-9\s-]{2,14})/i,
    /(?:engine|motor)[:\s]*([A-Z]\d{3,4}[A-Z]{1,3}\d{0,2})/i,
  ];

  for (const pat of labelPatterns) {
    const m = text.match(pat);
    if (m) {
      const code = m[1].trim().toUpperCase();
      if (code.length >= 4 && code.length <= 12 && !ENGINE_CODE_BLACKLIST.has(code)) {
        return code;
      }
    }
  }

  // Then try pattern matching on the full text
  for (const pat of ENGINE_CODE_PATTERNS) {
    const m = text.match(pat);
    if (m) {
      const code = m[1].toUpperCase();
      if (code.length >= 4 && code.length <= 12 && !ENGINE_CODE_BLACKLIST.has(code)) {
        return code;
      }
    }
  }

  return null;
}

// ═══════════════════════════════════════════════════════════════════════════
// Browser Pool
// ═══════════════════════════════════════════════════════════════════════════

/** @type {import('playwright').Browser | null} */
let browser = null;
let browserLastUsed = 0;
let browserCleanupTimer = null;

async function getBrowser() {
  if (!browser || !browser.isConnected()) {
    console.log("[browser] Launching Chromium...");
    browser = await chromium.launch({
      headless: HEADLESS,
      args: [
        "--disable-blink-features=AutomationControlled",
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--disable-gpu",
      ],
    });
    console.log("[browser] Chromium launched.");
  }
  browserLastUsed = Date.now();

  if (browserCleanupTimer) clearTimeout(browserCleanupTimer);
  browserCleanupTimer = setTimeout(async () => {
    if (browser && Date.now() - browserLastUsed >= BROWSER_REUSE_MS) {
      console.log("[browser] Idle timeout — closing browser.");
      await browser.close().catch(() => {});
      browser = null;
    }
  }, BROWSER_REUSE_MS + 1000);

  return browser;
}

// ═══════════════════════════════════════════════════════════════════════════
// Request Interception — blocks heavy resources, captures JSON payloads
// ═══════════════════════════════════════════════════════════════════════════

const BLOCK_RESOURCE_TYPES = new Set(["image", "media", "font"]);
const BLOCK_URL_PATTERNS = [
  /google-analytics\.com/,
  /googletagmanager\.com/,
  /facebook\.net/,
  /doubleclick\.net/,
  /adnxs\.com/,
  /analytics/,
  /tracking/,
  /\.woff2?$/,
  /\.ttf$/,
  /\.png$/,
  /\.jpg$/,
  /\.jpeg$/,
  /\.gif$/,
  /\.svg$/,
  /\.ico$/,
];

async function setupInterception(page, capturedJsons) {
  await page.route("**/*", (route) => {
    const request = route.request();
    const resourceType = request.resourceType();
    const url = request.url();

    // Block heavy resources
    if (BLOCK_RESOURCE_TYPES.has(resourceType)) {
      return route.abort();
    }

    // Block tracking/ad scripts
    for (const pattern of BLOCK_URL_PATTERNS) {
      if (pattern.test(url)) {
        return route.abort();
      }
    }

    // Let CSS through but mark it (don't block — some sites need it for layout)
    return route.continue();
  });

  // Capture JSON responses for data mining
  page.on("response", async (response) => {
    try {
      const contentType = response.headers()["content-type"] ?? "";
      const url = response.url();

      if (
        contentType.includes("application/json") &&
        response.status() === 200
      ) {
        const body = await response.text().catch(() => null);
        if (body && body.length > 50 && body.length < 500_000) {
          capturedJsons.push({ url, body });
        }
      }
    } catch {
      // Response already disposed, ignore
    }
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// JSON Data-Mining — __NEXT_DATA__, __INITIAL_STATE__, intercepted JSONs
// ═══════════════════════════════════════════════════════════════════════════

function mineJsonForVehicleData(jsons, pageData) {
  const mined = {
    engineCode: null,
    vin: null,
    make: null,
    model: null,
    year: null,
    fuelType: null,
    engineCc: null,
    powerKw: null,
    powerHp: null,
    gearbox: null,
    driveType: null,
    color: null,
    mileageKm: null,
  };

  // Combine all JSON sources
  const allTexts = [];

  // Page __NEXT_DATA__ and __INITIAL_STATE__
  if (pageData.nextData) allTexts.push(JSON.stringify(pageData.nextData));
  if (pageData.initialState) allTexts.push(JSON.stringify(pageData.initialState));

  // Captured network JSONs
  for (const j of jsons) {
    allTexts.push(j.body);
  }

  for (const text of allTexts) {
    if (!text) continue;

    // Try to parse as JSON and search for vehicle-related keys
    try {
      const obj = typeof text === "string" ? JSON.parse(text) : text;
      deepSearch(obj, mined, 0);
    } catch {
      // Not valid JSON, try regex on raw text
    }

    // Engine code from raw text
    if (!mined.engineCode) {
      mined.engineCode = extractEngineCode(text);
    }

    // VIN from raw text
    if (!mined.vin) {
      const vinMatch = text.match(/\b([A-HJ-NPR-Z0-9]{17})\b/);
      if (vinMatch) mined.vin = vinMatch[1];
    }
  }

  return mined;
}

// Recursively search JSON objects for vehicle-related fields
function deepSearch(obj, mined, depth) {
  if (depth > 10 || !obj || typeof obj !== "object") return;

  for (const [key, value] of Object.entries(obj)) {
    const lk = key.toLowerCase();

    if (typeof value === "string" && value.length > 0 && value.length < 200) {
      // Engine code
      if (
        !mined.engineCode &&
        (lk.includes("engine_code") || lk.includes("enginecode") ||
         lk.includes("motorkod") || lk.includes("motortyp") ||
         lk.includes("engine_type"))
      ) {
        mined.engineCode = value.trim().toUpperCase();
      }

      // VIN
      if (!mined.vin && (lk === "vin" || lk === "chassi" || lk === "chassis_number")) {
        if (/^[A-HJ-NPR-Z0-9]{17}$/.test(value.trim())) {
          mined.vin = value.trim();
        }
      }

      // Make/Brand
      if (!mined.make && (lk === "make" || lk === "brand" || lk === "manufacturer" || lk === "märke")) {
        mined.make = value.trim();
      }

      // Model
      if (!mined.model && (lk === "model" || lk === "modell" || lk === "model_name")) {
        mined.model = value.trim();
      }

      // Fuel
      if (!mined.fuelType && (lk === "fuel" || lk === "fuel_type" || lk === "bränsle" || lk === "drivmedel")) {
        mined.fuelType = value.trim();
      }

      // Color
      if (!mined.color && (lk === "color" || lk === "colour" || lk === "färg")) {
        mined.color = value.trim();
      }

      // Gearbox
      if (!mined.gearbox && (lk === "gearbox" || lk === "transmission" || lk === "växellåda")) {
        mined.gearbox = value.trim();
      }

      // Drive type
      if (!mined.driveType && (lk === "drive_type" || lk === "drivetrain" || lk === "drivhjul")) {
        mined.driveType = value.trim();
      }
    }

    if (typeof value === "number") {
      // Year
      if (!mined.year && (lk === "year" || lk === "model_year" || lk === "modellår" || lk === "årsmodell")) {
        if (value >= 1900 && value <= 2030) mined.year = value;
      }

      // Engine CC
      if (!mined.engineCc && (lk === "engine_cc" || lk === "displacement" || lk === "cylindervolym")) {
        if (value > 100 && value < 20000) mined.engineCc = value;
      }

      // Power kW
      if (!mined.powerKw && (lk === "power_kw" || lk === "kw" || lk === "effekt_kw")) {
        if (value > 10 && value < 2000) mined.powerKw = value;
      }

      // Power HP
      if (!mined.powerHp && (lk === "power_hp" || lk === "hp" || lk === "horsepower" || lk === "hk" || lk === "hästkrafter")) {
        if (value > 10 && value < 3000) mined.powerHp = value;
      }

      // Mileage (km)
      if (!mined.mileageKm && (lk === "mileage" || lk === "mileage_km" || lk === "odometer" ||
          lk === "mätarställning" || lk === "miltal" || lk === "meter_reading" ||
          lk === "distance" || lk === "km" || lk === "odometer_km")) {
        if (value > 100 && value < 2_000_000) mined.mileageKm = value;
      }
    }

    // Recurse into nested objects/arrays
    if (typeof value === "object" && value !== null) {
      deepSearch(value, mined, depth + 1);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Biluppgifter.se Deep Scraper (PRIMARY)
// ═══════════════════════════════════════════════════════════════════════════

async function scrapeBiluppgifter(regNr) {
  // Check if source is temporarily blocked
  if (biluppgifterBlocked && Date.now() - biluppgifterBlocked < BLOCK_COOLDOWN_MS) {
    console.log("[biluppgifter] Source blocked — cooling down...");
    return null;
  }

  const b = await getBrowser();
  const ua = getNextUA();
  const context = await b.newContext({
    userAgent: ua,
    locale: "sv-SE",
    viewport: { width: 1280, height: 800 },
    extraHTTPHeaders: {
      "Accept-Language": "sv-SE,sv;q=0.9,en;q=0.8",
    },
  });

  const page = await context.newPage();
  const capturedJsons = [];

  try {
    // Setup request interception + JSON capture
    await setupInterception(page, capturedJsons);

    const url = `https://biluppgifter.se/fordon/${encodeURIComponent(regNr)}`;
    console.log(`[biluppgifter] → ${url}  (UA: ${ua.slice(0, 40)}...)`);

    const response = await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: TIMEOUT_MS,
    });

    // ── Block Detection ──
    const status = response?.status() ?? 0;
    if (status === 403 || status === 429) {
      console.log(`[biluppgifter] ⛔ Blocked (${status}) — rotating UA, cooling down 5min`);
      biluppgifterBlocked = Date.now();
      return null;
    }

    // Wait for Cloudflare challenge
    try {
      await page.waitForFunction(
        () =>
          !document.title.includes("Just a moment") &&
          !document.title.includes("Checking"),
        { timeout: 15_000 },
      );
    } catch {
      console.log("[biluppgifter] Cloudflare challenge not resolved.");
      biluppgifterBlocked = Date.now();
      return null;
    }

    await page.waitForTimeout(2500);

    // ── Mine __NEXT_DATA__ and __INITIAL_STATE__ ──
    const pageData = await page.evaluate(() => {
      let nextData = null;
      let initialState = null;

      // Try __NEXT_DATA__ (Next.js sites)
      try {
        const el = document.getElementById("__NEXT_DATA__");
        if (el) nextData = JSON.parse(el.textContent);
      } catch { /* not a Next.js site */ }

      // Try window.__NEXT_DATA__
      try {
        if (window.__NEXT_DATA__) nextData = window.__NEXT_DATA__;
      } catch { /* nope */ }

      // Try __INITIAL_STATE__
      try {
        if (window.__INITIAL_STATE__) initialState = window.__INITIAL_STATE__;
      } catch { /* nope */ }

      // Try any window variable that contains vehicle data
      try {
        if (window.__PRELOADED_STATE__) initialState = window.__PRELOADED_STATE__;
      } catch { /* nope */ }

      return { nextData, initialState };
    });

    if (pageData.nextData) {
      console.log("[biluppgifter] Found __NEXT_DATA__");
    }
    console.log(`[biluppgifter] Captured ${capturedJsons.length} JSON responses`);

    // Mine JSON data
    const minedData = mineJsonForVehicleData(capturedJsons, pageData);

    const title = await page.title();
    if (
      title.includes("404") ||
      title.includes("Sök fordonsuppgifter") ||
      title.length < 5
    ) {
      console.log("[biluppgifter] Vehicle not found.");
      return null;
    }

    // ── Extract from page text (proven approach) ──
    const extracted = await page.evaluate((regNrArg) => {
      const body = document.body?.innerText ?? "";
      const lines = body.split("\n").map((l) => l.trim()).filter((l) => l);
      const bodyLower = body.toLowerCase();

      // ── Detect vehicle status (scrapped, exported, deregistered) ──
      let vehicleStatus = "active";
      const statusKeywords = [
        { pattern: "skrotad", status: "scrapped" },
        { pattern: "skrotat", status: "scrapped" },
        { pattern: "exporterad", status: "exported" },
        { pattern: "exporterat", status: "exported" },
        { pattern: "avregistrerad", status: "deregistered" },
        { pattern: "avregistrerat", status: "deregistered" },
        { pattern: "stulen", status: "stolen" },
        { pattern: "stulet", status: "stolen" },
      ];
      for (const { pattern, status } of statusKeywords) {
        if (bodyLower.includes(pattern)) {
          vehicleStatus = status;
          break;
        }
      }

      const labels = new Set([
        "Modellår", "Typ", "Färg", "Bränsle", "Växellåda", "Drivhjul",
        "Hästkrafter", "Förbrukning", "Utsläpp", "Mätarställning",
        "Motoreffekt", "Cylindervolym", "Motorkod",
      ]);

      const data = {};

      // ── Bidirectional scan: value ABOVE label (original) ──
      for (let i = 0; i < lines.length - 1; i++) {
        const nextLine = lines[i + 1];
        if (labels.has(nextLine) && !(nextLine in data)) {
          data[nextLine] = lines[i];
        }
      }

      // ── Bidirectional scan: value BELOW label (new) ──
      for (let i = 0; i < lines.length - 1; i++) {
        if (labels.has(lines[i]) && !(lines[i] in data)) {
          const val = lines[i + 1];
          // Only take it if it doesn't look like another label
          if (val && val.length < 80 && !labels.has(val)) {
            data[lines[i]] = val;
          }
        }
      }

      // ── DOM-based extraction (table cells, dt/dd, data attributes) ──
      let engineCodeFromDom = null;

      // Method 1: <table> — look for td/th containing "Motorkod" with adjacent value
      const allTds = document.querySelectorAll("td, th");
      for (const td of allTds) {
        const text = (td.textContent ?? "").trim();
        if (/^motorkod$/i.test(text)) {
          // Check next sibling td
          const nextTd = td.nextElementSibling;
          if (nextTd) {
            const val = (nextTd.textContent ?? "").trim();
            if (val.length >= 3 && val.length <= 20 && !/logga|login|visa|premium|köp/i.test(val)) {
              engineCodeFromDom = val;
              break;
            }
          }
          // Check parent row's last td
          const row = td.closest("tr");
          if (row && !engineCodeFromDom) {
            const tds = row.querySelectorAll("td");
            const lastTd = tds[tds.length - 1];
            if (lastTd && lastTd !== td) {
              const val = (lastTd.textContent ?? "").trim();
              if (val.length >= 3 && val.length <= 20 && !/logga|login|visa|premium|köp/i.test(val)) {
                engineCodeFromDom = val;
                break;
              }
            }
          }
        }
      }

      // Method 2: <dt>/<dd> pairs
      if (!engineCodeFromDom) {
        const allDts = document.querySelectorAll("dt");
        for (const dt of allDts) {
          if (/motorkod/i.test(dt.textContent ?? "")) {
            const dd = dt.nextElementSibling;
            if (dd && dd.tagName === "DD") {
              const val = (dd.textContent ?? "").trim();
              if (val.length >= 3 && val.length <= 20 && !/logga|login|visa|premium|köp/i.test(val)) {
                engineCodeFromDom = val;
                break;
              }
            }
          }
        }
      }

      // Method 3: elements with data-label or aria-label containing "motorkod"
      if (!engineCodeFromDom) {
        const candidates = document.querySelectorAll("[data-label], [aria-label]");
        for (const el of candidates) {
          const label = (el.getAttribute("data-label") ?? el.getAttribute("aria-label") ?? "").toLowerCase();
          if (label.includes("motorkod") || label.includes("engine code")) {
            const val = (el.textContent ?? "").trim();
            if (val.length >= 3 && val.length <= 20 && !/logga|login|visa|premium|köp/i.test(val)) {
              engineCodeFromDom = val;
              break;
            }
          }
        }
      }

      // Method 4: Scan ALL elements for "Motorkod" label pattern with adjacent value
      if (!engineCodeFromDom) {
        const allEls = document.querySelectorAll("span, div, p, label, h4, h5, h6");
        for (const el of allEls) {
          const text = (el.textContent ?? "").trim();
          if (text === "Motorkod" || text === "Motor kod" || text === "Engine code") {
            // Check next sibling
            let sibling = el.nextElementSibling;
            if (sibling) {
              const val = (sibling.textContent ?? "").trim();
              if (val.length >= 3 && val.length <= 20 && !/logga|login|visa|premium|köp/i.test(val)) {
                engineCodeFromDom = val;
                break;
              }
            }
            // Check parent's next sibling
            const parent = el.parentElement;
            if (parent && !engineCodeFromDom) {
              sibling = parent.nextElementSibling;
              if (sibling) {
                const val = (sibling.textContent ?? "").trim();
                if (val.length >= 3 && val.length <= 20 && !/logga|login|visa|premium|köp/i.test(val)) {
                  engineCodeFromDom = val;
                  break;
                }
              }
            }
          }
        }
      }

      // Title: "{Make} {Model}, {HP}hk, {Year}"
      let titleLine = null;
      for (const line of lines) {
        if (/\d+hk/.test(line) && /\d{4}/.test(line)) {
          titleLine = line;
          break;
        }
      }

      // VIN: "{REG} - {17-char VIN}"
      let vin = null;
      const regUpper = regNrArg.toUpperCase();
      for (const line of lines) {
        const vinMatch = line.match(
          new RegExp(`${regUpper}\\s*[-–]\\s*([A-HJ-NPR-Z0-9]{17})`, "i"),
        );
        if (vinMatch) {
          vin = vinMatch[1].toUpperCase();
          break;
        }
      }

      // Engine code from text data
      let engineCodeFromText = null;
      if (data["Motorkod"]) {
        engineCodeFromText = data["Motorkod"];
      }

      // Try finding engine code in all text
      const fullText = lines.join(" ");

      return { data, titleLine, vin, engineCodeFromText, engineCodeFromDom, fullText, vehicleStatus };
    }, regNr);

    const { data, titleLine, vin, engineCodeFromText, engineCodeFromDom, fullText, vehicleStatus } = extracted;

    if (engineCodeFromDom) {
      console.log(`[biluppgifter] 🔧 Engine code from DOM: ${engineCodeFromDom}`);
    }

    // ── Parse title line ──
    let make = null;
    let model = null;
    let hp = null;
    let yearFromTitle = null;

    if (titleLine) {
      let text = titleLine;
      const yearMatch = text.match(/,\s*(\d{4})\s*$/);
      if (yearMatch) {
        yearFromTitle = parseInt(yearMatch[1], 10);
        text = text.substring(0, yearMatch.index).trim();
      }
      const hpMatch = text.match(/,\s*(\d+)\s*hk\s*$/i);
      if (hpMatch) {
        hp = parseInt(hpMatch[1], 10);
        text = text.substring(0, hpMatch.index).trim();
      }
      const words = text.split(/\s+/);
      if (words.length >= 1) {
        const multiWordMakes = {
          alfa: "Alfa Romeo", aston: "Aston Martin",
          land: "Land Rover", rolls: "Rolls-Royce",
        };
        const firstLower = words[0].toLowerCase();
        if (words.length >= 2 && multiWordMakes[firstLower]) {
          make = multiWordMakes[firstLower];
          model = words.slice(2).join(" ");
        } else {
          make = words[0];
          model = words.slice(1).join(" ");
        }
      }
    }

    const yearStr = data["Modellår"];
    const year = yearStr ? parseInt(yearStr, 10) || yearFromTitle : yearFromTitle;

    if (!make && !model && !minedData.make) {
      return null;
    }

    // ── Determine engine code ──
    // Filter out login-wall texts that biluppgifter shows instead of actual data
    const JUNK_VALUES = new Set(["logga in", "login", "visa", "dölj", "premium", "pro", "köp", "nedc", "wltp", "euro 5", "euro 6", "euro 4"]);
    const cleanCode = (v) => v && !JUNK_VALUES.has(v.toLowerCase().trim()) ? v : null;

    let engineCode = cleanCode(engineCodeFromText)
      || cleanCode(engineCodeFromDom)
      || cleanCode(minedData.engineCode)
      || extractEngineCode(fullText)
      || null;

    // ── Parse cylinder volume ──
    let engineCc = minedData.engineCc || null;
    if (!engineCc && data["Cylindervolym"]) {
      const ccMatch = data["Cylindervolym"].match(/([\d\s,.]+)\s*(?:cc|cm³|cm3)?/i);
      if (ccMatch) {
        const val = parseFloat(ccMatch[1].replace(/[\s,]/g, "").replace(",", "."));
        if (!isNaN(val) && val > 100) engineCc = Math.round(val);
      }
    }

    // ── Parse power ──
    let powerKw = minedData.powerKw || null;
    if (!powerKw && data["Motoreffekt"]) {
      const kwMatch = data["Motoreffekt"].match(/(\d+)\s*kW/i);
      if (kwMatch) powerKw = parseInt(kwMatch[1], 10);
    }
    if (!powerKw && hp) {
      powerKw = Math.round(hp * 0.7457);
    }

    // ── Parse mileage from latest inspection ──
    let mileageKm = null;

    // Helper to parse a mileage string
    const parseMileage = (raw) => {
      if (!raw) return null;
      const kmMatch = raw.match(/([\d\s]+)\s*km/i);
      const milMatch = raw.match(/([\d\s]+)\s*mil(?!\w)/i); // "mil" but not "miles" or "miljon"
      if (kmMatch) {
        const val = parseInt(kmMatch[1].replace(/\s/g, ""), 10);
        if (!isNaN(val) && val > 100 && val < 2_000_000) return val;
      } else if (milMatch) {
        const val = parseInt(milMatch[1].replace(/\s/g, ""), 10);
        if (!isNaN(val) && val > 0 && val < 200_000) return val * 10; // mil → km
      }
      // Try bare number if it looks like km (> 1000)
      const bareMatch = raw.match(/([\d\s]{4,})/);
      if (bareMatch) {
        const val = parseInt(bareMatch[1].replace(/\s/g, ""), 10);
        if (!isNaN(val) && val >= 1000 && val < 2_000_000) return val;
      }
      return null;
    };

    // Method 1: From text-scanned data
    if (data["Mätarställning"]) {
      mileageKm = parseMileage(data["Mätarställning"]);
    }

    // Method 2: DOM-based mileage search (besiktningshistorik, table cells, dt/dd)
    if (!mileageKm) {
      const domMileage = await page.evaluate(() => {
        // 2a: Look for mätarställning in table cells
        const allTds = document.querySelectorAll("td, th");
        for (const td of allTds) {
          const text = (td.textContent ?? "").trim().toLowerCase();
          if (text.includes("mätarställning") || text.includes("odometer") || text.includes("miltal")) {
            const nextTd = td.nextElementSibling;
            if (nextTd) {
              const val = (nextTd.textContent ?? "").trim();
              if (/\d/.test(val) && val.length <= 30) return val;
            }
            // Check parent row
            const row = td.closest("tr");
            if (row) {
              const tds = row.querySelectorAll("td");
              const lastTd = tds[tds.length - 1];
              if (lastTd && lastTd !== td) {
                const val = (lastTd.textContent ?? "").trim();
                if (/\d/.test(val) && val.length <= 30) return val;
              }
            }
          }
        }

        // 2b: dt/dd pairs
        const allDts = document.querySelectorAll("dt");
        for (const dt of allDts) {
          const text = (dt.textContent ?? "").trim().toLowerCase();
          if (text.includes("mätarställning") || text.includes("miltal")) {
            const dd = dt.nextElementSibling;
            if (dd && dd.tagName === "DD") {
              const val = (dd.textContent ?? "").trim();
              if (/\d/.test(val) && val.length <= 30) return val;
            }
          }
        }

        // 2c: Labels anywhere (span, div, p) containing "mätarställning"
        const allEls = document.querySelectorAll("span, div, p, label, h4, h5, h6");
        for (const el of allEls) {
          const text = (el.textContent ?? "").trim();
          const textLower = text.toLowerCase();
          if ((textLower === "mätarställning" || textLower === "miltal" || textLower === "mätare") && text.length < 25) {
            // Check next sibling
            const nextEl = el.nextElementSibling;
            if (nextEl) {
              const val = (nextEl.textContent ?? "").trim();
              if (/\d/.test(val) && val.length <= 30 && !/logga|login|visa|premium/i.test(val)) return val;
            }
            // Check parent's next sibling
            const parent = el.parentElement;
            if (parent) {
              const parentNext = parent.nextElementSibling;
              if (parentNext) {
                const val = (parentNext.textContent ?? "").trim();
                if (/\d/.test(val) && val.length <= 30 && !/logga|login|visa|premium/i.test(val)) return val;
              }
            }
          }
        }

        // 2d: Look for "Senaste besiktning" section — mileage is often near it
        const bodyText = document.body?.innerText ?? "";
        const besiktMatch = bodyText.match(/(?:senaste\s*besiktning|besiktning|kontrollbesiktning)[^\n]*?\n[^\n]*?([\d\s]{3,})\s*km/i);
        if (besiktMatch) {
          return besiktMatch[1].trim() + " km";
        }

        // 2e: Generic regex on full page for "NNN NNN km" patterns near mileage keywords
        const mileagePattern = /(?:mätarställning|miltal|mätare|odometer)\s*:?\s*([\d\s]+)\s*(?:km|mil)/i;
        const match = bodyText.match(mileagePattern);
        if (match) return match[1].trim() + " km";

        return null;
      }).catch(() => null);

      if (domMileage) {
        mileageKm = parseMileage(domMileage);
        if (mileageKm) console.log(`[biluppgifter] 📏 Mileage from DOM: ${mileageKm} km`);
      }
    }

    // Method 3: Check mined JSON data for mileage
    if (!mileageKm && minedData.mileageKm) {
      const val = typeof minedData.mileageKm === "string" ? parseInt(minedData.mileageKm, 10) : minedData.mileageKm;
      if (!isNaN(val) && val > 100 && val < 2_000_000) {
        mileageKm = val;
        console.log(`[biluppgifter] 📏 Mileage from JSON data: ${mileageKm} km`);
      }
    }

    // Method 4: Fulltext regex scan for standalone "NNN NNN km"
    if (!mileageKm) {
      const kmPatterns = fullText.match(/(\d[\d\s]{2,8}\d)\s*km/gi);
      if (kmPatterns) {
        for (const p of kmPatterns) {
          const numStr = p.replace(/\s*km.*/i, "").replace(/\s/g, "");
          const val = parseInt(numStr, 10);
          if (!isNaN(val) && val >= 1000 && val < 2_000_000) {
            mileageKm = val;
            console.log(`[biluppgifter] 📏 Mileage from fulltext regex: ${mileageKm} km`);
            break;
          }
        }
      }
    }

    // Reset block status on successful scrape
    biluppgifterBlocked = 0;

    const result = {
      make: make || minedData.make || null,
      model: (model || minedData.model || null),
      year: year || minedData.year || null,
      fuel_type: mapFuel(data["Bränsle"] || minedData.fuelType),
      gearbox: mapGearbox(data["Växellåda"] || minedData.gearbox),
      drive_type: mapDriveType(data["Drivhjul"] || minedData.driveType),
      color: data["Färg"] || minedData.color || null,
      engine_cc: engineCc,
      power_kw: powerKw,
      vin: vin || minedData.vin || null,
      engine_code: engineCode,
      mileage_km: mileageKm,
      vehicle_status: vehicleStatus,
      source: "biluppgifter.se",
    };

    if (vehicleStatus !== "active") {
      console.log(`[biluppgifter] ⚠️ ${result.make} ${result.model} ${result.year} — STATUS: ${vehicleStatus.toUpperCase()}`);
    } else {
      console.log(`[biluppgifter] ✓ ${result.make} ${result.model} ${result.year} | VIN: ${result.vin} | Motor: ${result.engine_code} | ${result.power_kw}kW | ${result.mileage_km}km`);
    }
    return result;
  } catch (err) {
    console.error("[biluppgifter] Error:", err.message);
    return null;
  } finally {
    await context.close().catch(() => {});
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Car.info Deep Scraper (BACKUP)
// ═══════════════════════════════════════════════════════════════════════════

async function scrapeCarInfo(regNr) {
  if (carInfoBlocked && Date.now() - carInfoBlocked < BLOCK_COOLDOWN_MS) {
    console.log("[car.info] Source blocked — cooling down...");
    return null;
  }

  const b = await getBrowser();
  const ua = getNextUA();
  const context = await b.newContext({
    userAgent: ua,
    locale: "sv-SE",
    viewport: { width: 1280, height: 800 },
    extraHTTPHeaders: {
      "Accept-Language": "sv-SE,sv;q=0.9,en;q=0.8",
    },
  });

  // Load saved login cookies if available
  const savedCookies = loadCarInfoCookies();
  if (savedCookies) {
    try {
      await context.addCookies(savedCookies);
      console.log("[car.info] 🔑 Using saved login cookies");
    } catch (e) {
      console.log("[car.info] ⚠️ Failed to load cookies:", e.message);
    }
  }

  const page = await context.newPage();
  const capturedJsons = [];

  try {
    await setupInterception(page, capturedJsons);

    const url = `https://www.car.info/sv-se/license-plate/S/${encodeURIComponent(regNr)}`;
    console.log(`[car.info] → ${url}  (UA: ${ua.slice(0, 40)}...)`);

    const response = await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: TIMEOUT_MS,
    });

    // Block detection
    const status = response?.status() ?? 0;
    if (status === 403 || status === 429) {
      console.log(`[car.info] ⛔ Blocked (${status}) — cooling down`);
      carInfoBlocked = Date.now();
      return null;
    }

    await page.waitForTimeout(2000);

    // Coffee break detection
    const title = await page.title();
    if (title.includes("Coffee break") || title.includes("Kaffepaus")) {
      console.log("[car.info] Hit rate limit (Coffee break) — waiting 30s...");
      try {
        await page.waitForFunction(
          () =>
            !document.title.includes("Coffee") &&
            !document.title.includes("Kaffepaus"),
          { timeout: 35_000 },
        );
        await page.waitForTimeout(2000);
      } catch {
        carInfoBlocked = Date.now();
        return null;
      }
    }

    // CAPTCHA detection
    const content = await page.content();
    if (content.includes("datadome") && content.includes("captcha")) {
      console.log("[car.info] CAPTCHA detected.");
      carInfoBlocked = Date.now();
      return null;
    }

    // Mine JSON data
    const pageData = await page.evaluate(() => {
      let nextData = null;
      let initialState = null;
      try { const el = document.getElementById("__NEXT_DATA__"); if (el) nextData = JSON.parse(el.textContent); } catch {}
      try { if (window.__NEXT_DATA__) nextData = window.__NEXT_DATA__; } catch {}
      try { if (window.__INITIAL_STATE__) initialState = window.__INITIAL_STATE__; } catch {}
      return { nextData, initialState };
    });

    const minedData = mineJsonForVehicleData(capturedJsons, pageData);

    // Try to click "Specs"/"Mer"/"Specifikationer" tab to expand engine code details
    try {
      const clicked = await page.evaluate(() => {
        // Look for tabs/links containing "Spec" or "Mer" or "#specs"
        const candidates = [
          ...document.querySelectorAll('a[href*="specs"], a[href*="#specs"]'),
          ...document.querySelectorAll('button, a, [role="tab"]'),
        ];
        for (const el of candidates) {
          const text = (el.textContent ?? "").trim().toLowerCase();
          if (text === "specs" || text === "mer" || text === "specifikationer" ||
              text === "specifications" || text === "tekniska data" || text === "teknik") {
            el.click();
            return text;
          }
        }
        return null;
      });
      if (clicked) {
        console.log(`[car.info] Clicked "${clicked}" tab to expand specs`);
        await page.waitForTimeout(1500);
      }
    } catch { /* tab not found, continue */ }

    // Try to click "Visa alla"/"Show all"/"Mer info" to expand hidden spec sections
    try {
      const expanded = await page.evaluate(() => {
        const expandButtons = document.querySelectorAll("button, a, [role='button']");
        let clickCount = 0;
        for (const el of expandButtons) {
          const text = (el.textContent ?? "").trim().toLowerCase();
          if (text.includes("visa alla") || text.includes("show all") ||
              text.includes("mer info") || text.includes("more info") ||
              text.includes("visa mer") || text.includes("show more") ||
              text.includes("alla specifikationer") || text.includes("all specifications")) {
            el.click();
            clickCount++;
          }
        }
        return clickCount;
      });
      if (expanded > 0) {
        console.log(`[car.info] Expanded ${expanded} hidden section(s)`);
        await page.waitForTimeout(1500);
      }
    } catch { /* buttons not found */ }

    // Extract from page text
    const extracted = await page.evaluate((regNrArg) => {
      const body = document.body?.innerText ?? "";
      const lines = body.split("\n").map((l) => l.trim()).filter((l) => l);
      const h1 = document.querySelector("h1")?.textContent?.trim() ?? "";

      const junkFilter = (v) => v && !/logga|login|visa|premium|köp|\[|\]/i.test(v) && v !== "—";

      const specs = {};
      const specLabels = new Set([
        // English labels
        "Power", "Horsepower", "Displacement", "Transmission",
        "Drivetrain", "Fuel", "Fuel type", "Colour", "Color",
        "Engine code", "Engine", "Motor code", "Engine size",
        "Mileage", "Odometer",
        // Swedish labels (car.info sv-se)
        "Effekt", "Hästkrafter", "Motorvolym", "Cylindervolym",
        "Växellåda", "Drivlina", "Drivhjul", "Bränsle", "Färg",
        "Motorkod", "Motortyp", "Motor",
        "Mätarställning", "Miltal", "Mätare",
      ]);

      // Bidirectional text line scan
      for (let i = 0; i < lines.length - 1; i++) {
        // Label on current line, value on next
        if (specLabels.has(lines[i]) && lines[i + 1]?.length < 100 && junkFilter(lines[i + 1])) {
          if (!(lines[i] in specs)) specs[lines[i]] = lines[i + 1];
        }
        // Value on current line, label on next
        if (specLabels.has(lines[i + 1]) && lines[i]?.length < 100 && junkFilter(lines[i])) {
          if (!(lines[i + 1] in specs)) specs[lines[i + 1]] = lines[i];
        }
      }

      // ── DOM approach 1: .sptitle elements ──
      const sptitles = document.querySelectorAll(".sptitle");
      for (const el of sptitles) {
        const label = el.textContent?.trim();
        const next = el.nextElementSibling;
        const value = next?.textContent?.trim();
        if (label && value && junkFilter(value)) {
          specs[label] = value;
        }
      }

      // ── DOM approach 2: table rows ──
      const allTds = document.querySelectorAll("td, th");
      for (const td of allTds) {
        const text = (td.textContent ?? "").trim();
        const textLower = text.toLowerCase();
        if (textLower === "motorkod" || textLower === "engine code" || textLower === "motor code") {
          const nextTd = td.nextElementSibling;
          if (nextTd) {
            const val = (nextTd.textContent ?? "").trim();
            if (val.length >= 3 && val.length <= 20 && junkFilter(val) && !("Motorkod" in specs)) {
              specs["Motorkod"] = val;
            }
          }
          // Also check parent row
          const row = td.closest("tr");
          if (row && !specs["Motorkod"]) {
            const tds = row.querySelectorAll("td");
            const lastTd = tds[tds.length - 1];
            if (lastTd && lastTd !== td) {
              const val = (lastTd.textContent ?? "").trim();
              if (val.length >= 3 && val.length <= 20 && junkFilter(val)) {
                specs["Motorkod"] = val;
              }
            }
          }
        }
      }

      // ── DOM approach 3: dt/dd pairs ──
      const allDts = document.querySelectorAll("dt");
      for (const dt of allDts) {
        const label = (dt.textContent ?? "").trim();
        if (specLabels.has(label) || /motorkod|engine.?code/i.test(label)) {
          const dd = dt.nextElementSibling;
          if (dd && dd.tagName === "DD") {
            const val = (dd.textContent ?? "").trim();
            if (val.length < 100 && junkFilter(val)) {
              specs[label] = val;
            }
          }
        }
      }

      // ── DOM approach 4: generic label-value spans/divs ──
      const allSpans = document.querySelectorAll("span, div, p, label");
      for (const el of allSpans) {
        const text = (el.textContent ?? "").trim();
        if (/^(Motorkod|Engine code|Motor code)$/i.test(text) && !specs["Motorkod"]) {
          // Check next sibling
          const next = el.nextElementSibling;
          if (next) {
            const val = (next.textContent ?? "").trim();
            if (val.length >= 3 && val.length <= 20 && junkFilter(val)) {
              specs["Motorkod"] = val;
            }
          }
          // Check parent's next sibling
          if (!specs["Motorkod"]) {
            const parent = el.parentElement;
            const parentNext = parent?.nextElementSibling;
            if (parentNext) {
              const val = (parentNext.textContent ?? "").trim();
              if (val.length >= 3 && val.length <= 20 && junkFilter(val)) {
                specs["Motorkod"] = val;
              }
            }
          }
        }
      }

      const fullText = lines.join(" ");
      return { h1, specs, fullText };
    }, regNr);

    const { h1, specs, fullText } = extracted;

    if (!h1 || h1.includes("Coffee") || h1.includes("not found")) {
      return null;
    }

    const parsed = parseCarInfoH1(regNr, h1);
    if (!parsed.make && !minedData.make) return null;

    // ── Parse the "Motor" field (car.info combines fuel, displacement, hp) ──
    // Example: "Bensin, 5.0 V10 (507 hk)" or "Diesel, 2.0 (150 hk)"
    const motorField = specs["Motor"] ?? "";
    let motorCc = null;
    let motorKw = null;

    if (motorField) {
      // Extract displacement from "5.0 V10" or "2.0" patterns (liters)
      const literMatch = motorField.match(/(\d+[.,]\d+)\s*(?:V\d+|[LlIi])?/);
      if (literMatch) {
        const liters = parseFloat(literMatch[1].replace(",", "."));
        if (liters > 0.5 && liters < 15) {
          motorCc = Math.round(liters * 1000);
        }
      }

      // Extract HP from "(507 hk)" or "(150 hp)"
      const hpMatch = motorField.match(/(\d+)\s*(?:hk|hp|HK|HP)/);
      if (hpMatch) {
        motorKw = Math.round(parseInt(hpMatch[1], 10) * 0.7457);
      }
    }

    // Engine code — check both English and Swedish labels
    let engineCode = specs["Motorkod"] || specs["Engine code"] || specs["Motor code"]
      || specs["Motortyp"]
      || minedData.engineCode
      || extractEngineCode(fullText)
      || null;

    carInfoBlocked = 0; // success

    // ── Parse mileage ──
    let mileageKm = null;
    const mileageRaw = specs["Mätarställning"] ?? specs["Miltal"] ?? specs["Mätare"] ?? specs["Mileage"] ?? specs["Odometer"] ?? null;
    if (mileageRaw) {
      const kmMatch = mileageRaw.match(/([\d\s]+)\s*km/i);
      const milMatch = mileageRaw.match(/([\d\s]+)\s*mil(?!\w)/i);
      if (kmMatch) {
        const val = parseInt(kmMatch[1].replace(/\s/g, ""), 10);
        if (!isNaN(val) && val > 100 && val < 2_000_000) mileageKm = val;
      } else if (milMatch) {
        const val = parseInt(milMatch[1].replace(/\s/g, ""), 10);
        if (!isNaN(val) && val > 0 && val < 200_000) mileageKm = val * 10;
      } else {
        // Try bare number
        const bareMatch = mileageRaw.match(/([\d\s]{4,})/);
        if (bareMatch) {
          const val = parseInt(bareMatch[1].replace(/\s/g, ""), 10);
          if (!isNaN(val) && val >= 1000 && val < 2_000_000) mileageKm = val;
        }
      }
    }
    // Fulltext fallback for mileage
    if (!mileageKm) {
      const mileagePatterns = fullText.match(/(?:mätarställning|miltal|mätare|odometer|mileage)\s*:?\s*([\d\s]+)\s*(?:km|mil)/i);
      if (mileagePatterns) {
        const val = parseInt(mileagePatterns[1].replace(/\s/g, ""), 10);
        if (!isNaN(val) && val > 100 && val < 2_000_000) mileageKm = val;
      }
    }
    // JSON mined data fallback
    if (!mileageKm && minedData.mileageKm) {
      const val = typeof minedData.mileageKm === "string" ? parseInt(minedData.mileageKm, 10) : minedData.mileageKm;
      if (!isNaN(val) && val > 100 && val < 2_000_000) mileageKm = val;
    }

    const result = {
      make: parsed.make || minedData.make,
      model: parsed.model || minedData.model,
      year: parsed.year || minedData.year,
      fuel_type: mapFuel(specs["Bränsle"] ?? specs.Fuel ?? specs["Fuel type"] ?? motorField ?? minedData.fuelType),
      gearbox: mapGearbox(specs["Växellåda"] ?? specs.Transmission ?? parsed.gearboxHint ?? minedData.gearbox),
      drive_type: mapDriveType(specs["Drivlina"] ?? specs["Drivhjul"] ?? specs.Drivetrain ?? minedData.driveType),
      color: specs["Färg"] ?? specs.Colour ?? specs.Color ?? minedData.color ?? null,
      engine_cc: parseCc(specs["Motorvolym"] ?? specs["Cylindervolym"] ?? specs.Displacement ?? specs["Engine size"]) ?? motorCc ?? minedData.engineCc ?? null,
      power_kw:
        parseKw(specs["Effekt"] ?? specs.Power) ??
        motorKw ??
        minedData.powerKw ??
        (parsed.hp ? Math.round(parsed.hp * 0.7457) : null),
      vin: minedData.vin ?? null,
      engine_code: engineCode,
      mileage_km: mileageKm,
      source: "car.info",
    };

    console.log(`[car.info] ✓ ${result.make} ${result.model} ${result.year} | VIN: ${result.vin} | Motor: ${result.engine_code} | ${result.engine_cc}cc ${result.power_kw}kW | ${result.mileage_km}km`);
    console.log(`[car.info] Specs found:`, JSON.stringify(specs));
    return result;
  } catch (err) {
    console.error("[car.info] Error:", err.message);
    return null;
  } finally {
    await context.close().catch(() => {});
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// H1 Parser for car.info
// ═══════════════════════════════════════════════════════════════════════════

function parseCarInfoH1(regNr, h1) {
  let text = h1.trim();
  const prefixes = [`S${regNr}`, regNr];
  for (const prefix of prefixes) {
    const idx = text.indexOf(prefix);
    if (idx !== -1) { text = text.substring(idx + prefix.length).trim(); break; }
  }

  let year = null;
  const yearMatch = text.match(/,\s*(\d{4})\s*$/);
  if (yearMatch) { year = parseInt(yearMatch[1], 10); text = text.substring(0, yearMatch.index).trim(); }

  let hp = null;
  const hpMatch = text.match(/,\s*(\d+)\s*hp\s*$/i);
  if (hpMatch) { hp = parseInt(hpMatch[1], 10); text = text.substring(0, hpMatch.index).trim(); }

  let gearboxHint = null;
  const lt = text.toLowerCase();
  if (/steptronic|automatic|tiptronic|dsg|dct|s tronic/i.test(lt)) gearboxHint = "automat";
  else if (lt.includes("manual")) gearboxHint = "manuell";

  const multiWordMakes = { alfa: "Alfa Romeo", aston: "Aston Martin", land: "Land Rover", rolls: "Rolls-Royce" };
  const words = text.split(/\s+/);
  let make = words[0] || null;
  let modelStart = 1;
  if (words.length >= 2 && multiWordMakes[words[0].toLowerCase()]) {
    make = multiWordMakes[words[0].toLowerCase()];
    modelStart = 2;
  }

  let model = words.slice(modelStart).join(" ")
    .replace(/\b(?:Steptronic|TipTronic|Automatic|Manual|S Tronic|DSG|DCT|CVT)\b/gi, "")
    .replace(/\s+/g, " ").trim();

  return { make, model: model || null, year, hp, gearboxHint };
}

// ═══════════════════════════════════════════════════════════════════════════
// Value Mappers
// ═══════════════════════════════════════════════════════════════════════════

function mapFuel(raw) {
  if (!raw) return null;
  const lower = raw.toLowerCase();
  const map = {
    bensin: "bensin", petrol: "bensin", gasoline: "bensin",
    diesel: "diesel",
    el: "el", electric: "el", electricity: "el",
    hybrid: "hybrid",
    laddhybrid: "laddhybrid", "plug-in hybrid": "laddhybrid", phev: "laddhybrid",
    etanol: "etanol", ethanol: "etanol", e85: "etanol",
    gas: "gas", lng: "gas", lpg: "gas", cng: "gas",
  };
  for (const [key, val] of Object.entries(map)) {
    if (lower.includes(key)) return val;
  }
  return raw;
}

function mapGearbox(raw) {
  if (!raw) return null;
  const lower = raw.toLowerCase();
  if (/automat|automatic|cvt|dct|dsg|tiptronic|steptronic/.test(lower)) return "automat";
  if (/manuell|manual/.test(lower)) return "manuell";
  return raw;
}

function mapDriveType(raw) {
  if (!raw) return null;
  const lower = raw.toLowerCase();
  if (/front|framhjul|fwd/.test(lower)) return "framhjulsdrift";
  if (/rear|bakhjul|rwd/.test(lower)) return "bakhjulsdrift";
  if (/4wd|awd|fyrhjul|all wheel|four wheel|xdrive|quattro|4matic/.test(lower)) return "fyrhjulsdrift";
  return raw;
}

function parseKw(raw) {
  if (!raw) return null;
  const kwMatch = raw.match(/(\d+)\s*kW/i);
  if (kwMatch) return parseInt(kwMatch[1], 10);
  const hpMatch = raw.match(/(\d+)\s*(?:hp|hk|HK)/);
  if (hpMatch) return Math.round(parseInt(hpMatch[1], 10) * 0.7457);
  return null;
}

function parseCc(raw) {
  if (!raw) return null;
  const ccMatch = raw.match(/([\d,. ]+)\s*cc/i);
  if (ccMatch) {
    const val = parseFloat(ccMatch[1].replace(/[\s,]/g, ""));
    if (!isNaN(val)) return Math.round(val);
  }
  const literMatch = raw.match(/([\d,.]+)\s*l(?:iter|itre)?/i);
  if (literMatch) {
    const val = parseFloat(literMatch[1].replace(",", "."));
    if (!isNaN(val) && val > 0) return Math.round(val * 1000);
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════
// Lookup Orchestrator
// ═══════════════════════════════════════════════════════════════════════════

async function lookupVehicle(regNr) {
  const normalized = regNr.toUpperCase().replace(/[\s-]/g, "");
  console.log(`\n${"═".repeat(60)}`);
  console.log(`[lookup] 🔍 ${normalized}`);

  let primary = null;

  // Try biluppgifter.se first
  try {
    const result = await scrapeBiluppgifter(normalized);
    if (result && (result.make || result.model)) {
      primary = result;
    }
  } catch (err) {
    console.error("[lookup] biluppgifter.se failed:", err.message);
  }

  // Try car.info — either as full backup (if biluppgifter failed)
  // or as supplement for missing engine_code / VIN / engine_cc / power_kw
  const needsExtra = !primary || !primary.engine_code || !primary.vin || !primary.engine_cc || !primary.power_kw;
  if (needsExtra) {
    try {
      const result = await scrapeCarInfo(normalized);
      if (result && (result.make || result.model)) {
        if (!primary) {
          // Full backup — biluppgifter failed entirely
          primary = result;
        } else {
          // Supplement missing fields from car.info
          if (!primary.engine_code && result.engine_code) {
            console.log(`[lookup] 🔧 Got engine_code from car.info: ${result.engine_code}`);
            primary.engine_code = result.engine_code;
          }
          if (!primary.vin && result.vin) {
            console.log(`[lookup] 🔧 Got VIN from car.info: ${result.vin}`);
            primary.vin = result.vin;
          }
          if (!primary.engine_cc && result.engine_cc) {
            console.log(`[lookup] 🔧 Got engine_cc from car.info: ${result.engine_cc}`);
            primary.engine_cc = result.engine_cc;
          }
          if (!primary.power_kw && result.power_kw) {
            console.log(`[lookup] 🔧 Got power_kw from car.info: ${result.power_kw}`);
            primary.power_kw = result.power_kw;
          }
          if (!primary.gearbox && result.gearbox) {
            primary.gearbox = result.gearbox;
          }
          if (!primary.drive_type && result.drive_type) {
            primary.drive_type = result.drive_type;
          }
          if (!primary.mileage_km && result.mileage_km) {
            console.log(`[lookup] 🔧 Got mileage_km from car.info: ${result.mileage_km}`);
            primary.mileage_km = result.mileage_km;
          }
        }
      }
    } catch (err) {
      console.error("[lookup] car.info failed:", err.message);
    }
  }

  if (primary) {
    // Log what's still missing for debugging
    const missing = [];
    if (!primary.engine_code) missing.push("engine_code");
    if (!primary.vin) missing.push("vin");
    if (!primary.engine_cc) missing.push("engine_cc");
    if (!primary.power_kw) missing.push("power_kw");
    if (!primary.mileage_km) missing.push("mileage_km");
    if (missing.length > 0) {
      console.log(`[lookup] ⚠️ Still missing: ${missing.join(", ")}`);
    }
    return { success: true, data: primary };
  }

  console.log(`[lookup] ✗ No data found for ${normalized}`);
  return { success: false, data: null };
}

// ═══════════════════════════════════════════════════════════════════════════
// HTTP Server
// ═══════════════════════════════════════════════════════════════════════════

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const path = url.pathname;

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Content-Type", "application/json");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  if (path === "/health") {
    res.writeHead(200);
    res.end(JSON.stringify({
      status: "ok",
      browser: browser?.isConnected() ?? false,
      sources: {
        biluppgifter: biluppgifterBlocked ? "blocked" : "ok",
        carinfo: carInfoBlocked ? "blocked" : "ok",
      },
    }));
    return;
  }

  const lookupMatch = path.match(/^\/lookup\/([A-Za-z0-9]+)$/);
  if (lookupMatch) {
    const regNr = lookupMatch[1];
    const start = Date.now();
    try {
      const result = await lookupVehicle(regNr);
      const elapsed = ((Date.now() - start) / 1000).toFixed(1);
      console.log(`[lookup] Completed in ${elapsed}s`);
      res.writeHead(200);
      res.end(JSON.stringify(result));
    } catch (err) {
      console.error("[server] Lookup error:", err);
      res.writeHead(500);
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
    return;
  }

  // ── car.info login (opens visible browser for manual login) ──
  if (path === "/carinfo-login" && req.method === "POST") {
    res.writeHead(200);
    res.end(JSON.stringify({ status: "opening", message: "Öppnar car.info login i webbläsare..." }));

    // Run login flow in background (non-blocking)
    (async () => {
      let loginBrowser = null;
      try {
        console.log("[car.info] 🔐 Opening visible browser for login...");
        const { chromium } = await import("playwright");
        loginBrowser = await chromium.launch({
          headless: false,  // VISIBLE browser
          args: ["--start-maximized"],
        });

        const context = await loginBrowser.newContext({
          viewport: { width: 1280, height: 900 },
          locale: "sv-SE",
        });
        const page = await context.newPage();

        await page.goto("https://www.car.info/sv-se/user/login", {
          waitUntil: "domcontentloaded",
          timeout: 30_000,
        });

        console.log("[car.info] 🔐 Waiting for login (up to 5 minutes)...");
        console.log("[car.info] 🔐 Log in manually, then the cookies will be saved automatically.");

        // Wait until URL changes away from login page (meaning user logged in)
        // Or look for a "logout" / "mitt konto" link = successfully logged in
        try {
          await page.waitForFunction(() => {
            const url = window.location.href;
            // No longer on login page
            if (!url.includes("/login") && !url.includes("/sign")) return true;
            // Check for logged-in indicators
            const body = document.body?.innerText?.toLowerCase() ?? "";
            if (body.includes("logga ut") || body.includes("log out") || body.includes("mitt konto") || body.includes("my account")) return true;
            return false;
          }, { timeout: 300_000 }); // 5 minutes
        } catch {
          console.log("[car.info] ⏰ Login timeout (5 min) — closing browser.");
          await loginBrowser.close().catch(() => {});
          return;
        }

        // Grab cookies
        const cookies = await context.cookies();
        console.log(`[car.info] ✅ Login successful! Got ${cookies.length} cookies.`);

        // Save cookies to file
        const cookieDir = path_module.dirname(CARINFO_COOKIE_FILE);
        if (!fs.existsSync(cookieDir)) fs.mkdirSync(cookieDir, { recursive: true });
        fs.writeFileSync(CARINFO_COOKIE_FILE, JSON.stringify(cookies, null, 2));
        console.log(`[car.info] 💾 Cookies saved to ${CARINFO_COOKIE_FILE}`);

        // Reset blocked status
        carInfoBlocked = 0;
        console.log("[car.info] ✅ car.info unblocked and ready!");

        // Close browser after short delay
        await page.waitForTimeout(2000);
        await loginBrowser.close().catch(() => {});
      } catch (err) {
        console.error("[car.info] Login error:", err.message);
        if (loginBrowser) await loginBrowser.close().catch(() => {});
      }
    })();
    return;
  }

  // ── car.info status + unblock ──
  if (path === "/carinfo-status") {
    const hasCookies = fs.existsSync(CARINFO_COOKIE_FILE);
    let cookieAge = null;
    if (hasCookies) {
      try {
        const stat = fs.statSync(CARINFO_COOKIE_FILE);
        cookieAge = Math.round((Date.now() - stat.mtimeMs) / (1000 * 60 * 60)); // hours
      } catch {}
    }
    res.writeHead(200);
    res.end(JSON.stringify({
      blocked: carInfoBlocked > 0,
      blockedSince: carInfoBlocked > 0 ? new Date(carInfoBlocked).toISOString() : null,
      hasCookies,
      cookieAgeHours: cookieAge,
    }));
    return;
  }

  // ── Reset car.info block status ──
  if (path === "/carinfo-unblock" && req.method === "POST") {
    carInfoBlocked = 0;
    console.log("[car.info] 🔓 Block status manually reset.");
    res.writeHead(200);
    res.end(JSON.stringify({ status: "ok", message: "car.info unblocked" }));
    return;
  }

  res.writeHead(404);
  res.end(JSON.stringify({ error: "Not found" }));
});

// Graceful shutdown
async function shutdown() {
  console.log("\n[shutdown] Closing...");
  server.close();
  if (browser) await browser.close().catch(() => {});
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

server.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║  JM Assist — Deep Vehicle Lookup Service v2               ║
║  http://localhost:${PORT}                                   ║
║                                                           ║
║  GET /health           → Health + source status           ║
║  GET /lookup/:regNr    → Deep vehicle lookup              ║
║                                                           ║
║  Features:                                                ║
║  • Request interception (blocks images/CSS/trackers)      ║
║  • JSON data-mining (__NEXT_DATA__, network capture)      ║
║  • Engine code extraction (Volvo, BMW, VW, etc.)          ║
║  • User-Agent rotation (${USER_AGENTS.length} agents in pool)              ║
║  • Auto block detection (403/429 → 5min cooldown)         ║
║                                                           ║
║  Sources: biluppgifter.se → car.info (fallback)           ║
║  Engine: Playwright + Chromium (headless: ${HEADLESS})         ║
║                                                           ║
║  Ctrl+C to stop                                           ║
╚═══════════════════════════════════════════════════════════╝
  `);
});
