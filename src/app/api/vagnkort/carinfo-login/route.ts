import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";

const VEHICLE_LOOKUP_URL =
  process.env.VEHICLE_LOOKUP_URL ?? "http://localhost:8100";

/**
 * POST /api/vagnkort/carinfo-login
 * Triggers car.info login flow on the lookup service (opens visible browser).
 */
export async function POST() {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const res = await fetch(`${VEHICLE_LOOKUP_URL}/carinfo-login`, {
      method: "POST",
      signal: AbortSignal.timeout(5_000),
    });
    const data = await res.json();
    return NextResponse.json(data);
  } catch (err: any) {
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
