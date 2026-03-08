import { NextRequest, NextResponse } from "next/server";
import { getAvailability } from "@/lib/scheduling/availability";
import { getCorsHeaders } from "@/lib/middleware/cors";

/**
 * GET /api/availability?days=30&duration_minutes=60
 *
 * Public endpoint (no auth required, protected by rate limiting / CORS).
 * Returns available booking slots for the next N days.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const days            = Math.min(90, Math.max(1, parseInt(searchParams.get("days")             ?? "30")));
  const durationMinutes = Math.min(480, Math.max(15, parseInt(searchParams.get("duration_minutes") ?? "60")));

  try {
    const availability = await getAvailability(days, durationMinutes);

    const response = NextResponse.json({
      data:             availability,
      durationMinutes,
      generatedAt:      new Date().toISOString(),
    });

    // Add CORS headers
    const corsHeaders = getCorsHeaders(request);
    Object.entries(corsHeaders).forEach(([k, v]) => {
      if (v) response.headers.set(k, v);
    });

    return response;
  } catch (err) {
    console.error("[availability] Error:", err);
    return NextResponse.json({ error: "Kunde inte hämta tillgänglighet" }, { status: 500 });
  }
}
