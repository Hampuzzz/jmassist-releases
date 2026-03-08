import { NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

const VEHICLE_LOOKUP_URL =
  process.env.VEHICLE_LOOKUP_URL ?? "http://localhost:8100";

/**
 * POST /api/vagnkort/biluppgifter-login
 * Triggers biluppgifter.se BankID login flow on the lookup service.
 */
export async function POST() {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
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
