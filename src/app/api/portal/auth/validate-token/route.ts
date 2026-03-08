import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { portalAccounts } from "@/lib/db/schemas";
import { eq } from "drizzle-orm";

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.json({ valid: false, error: "Token saknas" }, { status: 400 });
  }

  const [account] = await db.select().from(portalAccounts).where(eq(portalAccounts.inviteToken, token)).limit(1);

  if (!account) {
    return NextResponse.json({ valid: false, error: "Ogiltig token" }, { status: 404 });
  }

  if (account.inviteExpiresAt && new Date(account.inviteExpiresAt) < new Date()) {
    return NextResponse.json({ valid: false, error: "Token har gått ut" }, { status: 410 });
  }

  return NextResponse.json({ valid: true, email: account.email });
}
