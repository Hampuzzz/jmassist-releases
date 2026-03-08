import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { searchPartPrices } from "@/lib/procurement/price-search";

/**
 * POST /api/procurement/search
 * Search for part prices across multiple sources.
 * Body: { partId: string, urgency?: "today" | "this_week" | "no_rush" }
 */
export async function POST(request: NextRequest) {
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { partId, urgency } = await request.json();
  if (!partId) {
    return NextResponse.json({ error: "partId krävs" }, { status: 400 });
  }

  const result = await searchPartPrices(partId, urgency ?? "no_rush");
  return NextResponse.json(result);
}
