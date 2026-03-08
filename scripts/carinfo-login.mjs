#!/usr/bin/env node
/**
 * Car.info Login Helper
 *
 * Opens a visible Chromium browser so you can log in to car.info manually.
 * After login, cookies are saved to data/carinfo-cookies.json
 * and the scraper will use them automatically.
 *
 * Usage:  node scripts/carinfo-login.mjs
 */

import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const COOKIE_FILE = path.join(process.cwd(), "data", "carinfo-cookies.json");
const LOGIN_URL = "https://www.car.info/sv-se/login";

async function main() {
  // Ensure data directory exists
  const dataDir = path.dirname(COOKIE_FILE);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  console.log(`
╔═══════════════════════════════════════════════════════════╗
║  Car.info Login Helper (auto-detect)                      ║
║                                                           ║
║  1. En synlig webbläsare öppnas med car.info              ║
║  2. Logga in med ditt konto                               ║
║  3. Scriptet upptäcker automatiskt när du loggat in       ║
║  4. Cookies sparas till: data/carinfo-cookies.json        ║
║                                                           ║
║  Scrapern använder sedan dina cookies automatiskt!        ║
╚═══════════════════════════════════════════════════════════╝
  `);

  const browser = await chromium.launch({
    headless: false,
    args: [
      "--disable-blink-features=AutomationControlled",
      "--no-sandbox",
    ],
  });

  const context = await browser.newContext({
    locale: "sv-SE",
    viewport: { width: 1280, height: 900 },
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  });

  // Load existing cookies if available
  if (fs.existsSync(COOKIE_FILE)) {
    try {
      const existingCookies = JSON.parse(fs.readFileSync(COOKIE_FILE, "utf-8"));
      await context.addCookies(existingCookies);
      console.log(`[login] Loaded ${existingCookies.length} existing cookies`);
    } catch {
      console.log("[login] No valid existing cookies found");
    }
  }

  const page = await context.newPage();

  console.log("[login] Öppnar car.info login...");
  await page.goto(LOGIN_URL, { waitUntil: "domcontentloaded", timeout: 30_000 });

  console.log("\n🔑 Logga in i webbläsaren nu...");
  console.log("   Scriptet väntar tills du är inloggad (max 5 min)...\n");

  // Auto-detect login by polling every 3 seconds
  const MAX_WAIT_MS = 300_000; // 5 minutes
  const POLL_MS = 3_000;
  let elapsed = 0;
  let loggedIn = false;

  while (!loggedIn && elapsed < MAX_WAIT_MS) {
    await page.waitForTimeout(POLL_MS);
    elapsed += POLL_MS;

    try {
      const currentUrl = page.url();
      // If URL navigated away from login page, user probably logged in
      if (!currentUrl.includes("/login") && !currentUrl.includes("/register")) {
        console.log(`[login] URL ändrades till: ${currentUrl}`);
        loggedIn = true;
        break;
      }

      // Check for logged-in indicators on page
      const bodyText = await page.evaluate(() => document.body?.innerText ?? "");
      if (
        bodyText.includes("Logga ut") ||
        bodyText.includes("Log out") ||
        bodyText.includes("Mitt konto") ||
        bodyText.includes("My account") ||
        bodyText.includes("Min profil")
      ) {
        console.log("[login] Inloggning upptäckt via sidinnehåll!");
        loggedIn = true;
        break;
      }
    } catch {
      // Page might be navigating, ignore
    }

    if (elapsed % 15_000 === 0) {
      console.log(`[login] Väntar på inloggning... (${elapsed / 1000}s)`);
    }
  }

  if (!loggedIn) {
    console.log("\n⚠️ Timeout — sparar cookies ändå (du kanske redan loggade in).");
  } else {
    console.log("\n✅ Inloggning upptäckt!");
    // Wait a bit for cookies to settle
    await page.waitForTimeout(2000);
  }

  // Save all cookies
  const cookies = await context.cookies();
  fs.writeFileSync(COOKIE_FILE, JSON.stringify(cookies, null, 2), "utf-8");

  console.log(`\n✅ Sparade ${cookies.length} cookies till ${COOKIE_FILE}`);

  // Verify login by checking a vehicle page
  console.log("[login] Verifierar inloggning...");
  try {
    await page.goto("https://www.car.info/sv-se/license-plate/S/FMJ660", {
      waitUntil: "domcontentloaded",
      timeout: 15_000,
    });
    await page.waitForTimeout(3000);

    const bodyText = await page.evaluate(() => document.body?.innerText ?? "");
    const hasVin = /[A-HJ-NPR-Z0-9]{17}/.test(bodyText);
    const hasMotorkod = bodyText.includes("Motorkod") || bodyText.includes("motorkod");

    if (hasVin) console.log("   ✅ VIN synligt — inloggning fungerar!");
    if (hasMotorkod) console.log("   ✅ Motorkod synligt — premium-data tillgängligt!");
    if (!hasVin && !hasMotorkod) console.log("   ⚠️ Kunde inte verifiera — men cookies är sparade.");
  } catch {
    console.log("   ⚠️ Verifiering misslyckades — cookies sparade ändå.");
  }

  await browser.close();
  console.log("\n🎉 Klart! Starta om lookup-tjänsten så använder den dina cookies.");
  console.log("   node scripts/vehicle-lookup-service.mjs\n");
  process.exit(0);
}

main().catch((err) => {
  console.error("Fel:", err.message);
  process.exit(1);
});
