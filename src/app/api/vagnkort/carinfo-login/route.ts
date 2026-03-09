import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

const VEHICLE_LOOKUP_URL =
  process.env.VEHICLE_LOOKUP_URL ?? "http://localhost:8100";

/**
 * POST /api/vagnkort/carinfo-login
 *
 * Two modes:
 * 1. With `{ cookies: [...] }` body → imports cookies to MagicNUC (from Electron login window)
 * 2. Without body → triggers remote Playwright login on MagicNUC (fallback)
 */
export async function POST(request: NextRequest) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Check if cookies are provided (from Electron login window)
    const body = await request.json().catch(() => null);

    if (body?.cookies && Array.isArray(body.cookies) && body.cookies.length > 0) {
      // Import cookies to MagicNUC (datahunter expects raw array, not { cookies: [] })
      const res = await fetch(`${VEHICLE_LOOKUP_URL}/carinfo-set-cookies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body.cookies),
        signal: AbortSignal.timeout(5_000),
      });
      const data = await res.json();
      if (!res.ok) {
        return NextResponse.json(
          { error: data.error ?? "MagicNUC avvisade cookies", status: res.status },
          { status: 502 },
        );
      }
      return NextResponse.json(data);
    }

    // Fallback: trigger remote Playwright login on MagicNUC
    const res = await fetch(`${VEHICLE_LOOKUP_URL}/carinfo-login`, {
      method: "POST",
      signal: AbortSignal.timeout(5_000),
    });
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: "Kunde inte nå uppslagstjänsten. Kör den med: node scripts/vehicle-lookup-service.mjs" },
      { status: 503 },
    );
  }
}

/**
 * GET /api/vagnkort/carinfo-login
 * Returns car.info connection status (blocked, cookies, etc.)
 */
export async function GET() {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [statusRes, healthRes] = await Promise.all([
      fetch(`${VEHICLE_LOOKUP_URL}/carinfo-status`, {
        signal: AbortSignal.timeout(3_000),
      }),
      fetch(`${VEHICLE_LOOKUP_URL}/health`, {
        signal: AbortSignal.timeout(3_000),
      }),
    ]);

    const status = await statusRes.json();
    const health = await healthRes.json();

    return NextResponse.json({
      ...status,
      serviceRunning: health.status === "ok",
      sources: health.sources,
    });
  } catch {
    return NextResponse.json(
      { serviceRunning: false, blocked: true, hasCookies: false },
    );
  }
}
