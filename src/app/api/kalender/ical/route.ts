import { NextRequest, NextResponse } from "next/server";
import { verifyICalToken, generateICalFeed, signICalToken } from "@/lib/scheduling/ical";
import { createServerClient } from "@/lib/supabase/server";

/**
 * GET /api/kalender/ical?token=<jwt>
 * Returns iCal format for external calendar apps (Google, Apple, Outlook).
 *
 * GET /api/kalender/ical (authenticated, no token) → returns a new token URL
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");

  // Case 1: Token provided - serve the iCal feed (for calendar app subscriptions)
  if (token) {
    const userId = await verifyICalToken(token);
    if (!userId) {
      return new NextResponse("Ogiltig eller utgången token", { status: 401 });
    }

    const icalContent = await generateICalFeed();

    return new NextResponse(icalContent, {
      status: 200,
      headers: {
        "Content-Type":        "text/calendar; charset=utf-8",
        "Content-Disposition": `attachment; filename="verkstad-kalender.ics"`,
        "Cache-Control":       "no-cache, no-store",
      },
    });
  }

  // Case 2: No token - user must be authenticated; return a subscription URL
  const supabase = createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const newToken = await signICalToken(user.id);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const subscriptionUrl = `${appUrl}/api/kalender/ical?token=${newToken}`;

  return NextResponse.json({
    subscriptionUrl,
    instructions: "Lägg till denna URL i din kalenderapp (Google, Apple, Outlook) för automatisk synkronisering.",
  });
}
