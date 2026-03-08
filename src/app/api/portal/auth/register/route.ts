import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { portalAccounts } from "@/lib/db/schemas";
import { eq, and, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";

export async function POST(request: Request) {
  try {
    const { token, password } = await request.json();
    if (!token || !password) {
      return NextResponse.json({ error: "Token och lösenord krävs" }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: "Lösenordet måste vara minst 8 tecken" }, { status: 400 });
    }

    const [account] = await db.select().from(portalAccounts).where(eq(portalAccounts.inviteToken, token)).limit(1);

    if (!account) {
      return NextResponse.json({ error: "Ogiltig eller utgången inbjudningslänk" }, { status: 400 });
    }

    if (account.inviteExpiresAt && new Date(account.inviteExpiresAt) < new Date()) {
      return NextResponse.json({ error: "Inbjudningslänken har gått ut" }, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    await db.update(portalAccounts).set({
      passwordHash,
      inviteToken: null,
      inviteExpiresAt: null,
      updatedAt: new Date(),
    }).where(eq(portalAccounts.id, account.id));

    return NextResponse.json({ message: "Lösenord skapat" });
  } catch (err: any) {
    console.error("[portal-register]", err);
    return NextResponse.json({ error: "Serverfel" }, { status: 500 });
  }
}
