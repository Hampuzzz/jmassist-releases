import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

const VEHICLE_LOOKUP_URL =
  process.env.VEHICLE_LOOKUP_URL ?? "http://localhost:8100";

export type ScraperServiceStatus = {
  serviceRunning: boolean;
  carinfo: {
    hasCookies: boolean;
    cookieAgeHours: number | null;
    tokenValid: boolean;
    tokenExpiresAt: string | null;
    blocked: boolean;
  };
  biluppgifter: {
    hasCookies: boolean;
    cookieAgeHours: number | null;
    cfClearanceValid: boolean;
    cfClearanceExpiresAt: string | null;
  };
  /** List of human-readable warnings (Swedish) */
  warnings: string[];
};

/**
 * GET /api/scraper/status
 * Combined scraper health + token/cookie validity check.
 * Used by the dashboard to show warnings when login is needed.
 */
export async function GET() {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result: ScraperServiceStatus = {
    serviceRunning: false,
    carinfo: {
      hasCookies: false,
      cookieAgeHours: null,
      tokenValid: false,
      tokenExpiresAt: null,
      blocked: false,
    },
    biluppgifter: {
      hasCookies: false,
      cookieAgeHours: null,
      cfClearanceValid: false,
      cfClearanceExpiresAt: null,
    },
    warnings: [],
  };

  try {
    const [healthRes, ciRes, biRes] = await Promise.all([
      fetch(`${VEHICLE_LOOKUP_URL}/health`, { signal: AbortSignal.timeout(3_000) }),
      fetch(`${VEHICLE_LOOKUP_URL}/carinfo-status`, { signal: AbortSignal.timeout(3_000) }),
      fetch(`${VEHICLE_LOOKUP_URL}/biluppgifter-status`, { signal: AbortSignal.timeout(3_000) }),
    ]);

    if (healthRes.ok) {
      const health = await healthRes.json();
      result.serviceRunning = health.status === "ok";
    }

    if (ciRes.ok) {
      const ci = await ciRes.json();
      result.carinfo = {
        hasCookies: ci.hasCookies ?? false,
        cookieAgeHours: ci.cookieAgeHours ?? null,
        tokenValid: ci.tokenValid ?? false,
        tokenExpiresAt: ci.tokenExpiresAt ?? null,
        blocked: ci.blocked ?? false,
      };
    }

    if (biRes.ok) {
      const bi = await biRes.json();
      result.biluppgifter = {
        hasCookies: bi.hasCookies ?? false,
        cookieAgeHours: bi.cookieAgeHours ?? null,
        cfClearanceValid: bi.cfClearanceValid ?? false,
        cfClearanceExpiresAt: bi.cfClearanceExpiresAt ?? null,
      };
    }
  } catch {
    result.warnings.push("Scrapern (MagicNUC) svarar inte — kontrollera att den körs.");
    return NextResponse.json(result);
  }

  // ── Generate warnings ──
  if (!result.serviceRunning) {
    result.warnings.push("Scrapern (MagicNUC) svarar inte — kontrollera att den körs.");
  }

  // car.info warnings
  if (!result.carinfo.hasCookies) {
    result.warnings.push("car.info: Ej inloggad — logga in via Vagnkort-sidan.");
  } else if (!result.carinfo.tokenValid) {
    result.warnings.push("car.info: Sessionen har gått ut — logga in igen via Vagnkort-sidan.");
  } else if (result.carinfo.blocked) {
    result.warnings.push("car.info: Tillfälligt blockerad (rate limit) — vänta en stund.");
  }

  // biluppgifter.se warnings
  if (!result.biluppgifter.hasCookies) {
    result.warnings.push("biluppgifter.se: Ej inloggad — logga in med BankID via Vagnkort-sidan.");
  } else if (!result.biluppgifter.cfClearanceValid) {
    result.warnings.push("biluppgifter.se: Cloudflare-session har gått ut — logga in igen med BankID.");
  }

  return NextResponse.json(result);
}
