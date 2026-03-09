import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

const VEHICLE_LOOKUP_URL =
  process.env.VEHICLE_LOOKUP_URL ?? "http://localhost:8100";

/**
 * POST /api/vagnkort/biluppgifter-login
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
      // Import cookies + user-agent to MagicNUC
      const res = await fetch(`${VEHICLE_LOOKUP_URL}/biluppgifter-set-cookies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cookies: body.cookies, userAgent: body.userAgent || null }),
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
    const res = await fetch(`${VEHICLE_LOOKUP_URL}/biluppgifter-login`, {
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
 * GET /api/vagnkort/biluppgifter-login
 * Returns biluppgifter.se connection status.
 */
export async function GET() {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const res = await fetch(`${VEHICLE_LOOKUP_URL}/biluppgifter-status`, {
      signal: AbortSignal.timeout(3_000),
    });
    const data = await res.json();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({
      hasCookies: false,
      cookieAgeHours: null,
      cfClearanceValid: false,
      blocked: false,
    });
  }
}
