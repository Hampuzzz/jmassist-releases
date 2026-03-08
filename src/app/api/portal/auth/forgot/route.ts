import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { portalAccounts } from "@/lib/db/schemas";
import { sql, eq } from "drizzle-orm";
import crypto from "crypto";

export async function POST(request: Request) {
  try {
    const { email } = await request.json();
    if (!email) {
      return NextResponse.json({ error: "E-post krävs" }, { status: 400 });
    }

    const [account] = await db.select().from(portalAccounts).where(sql`lower(${portalAccounts.email}) = ${email.toLowerCase()}`).limit(1);

    // Always return success to avoid email enumeration
    if (!account) {
      return NextResponse.json({ message: "Om e-postadressen finns skickas en återställningslänk" });
    }

    const resetToken = crypto.randomUUID();
    const resetExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await db.update(portalAccounts).set({
      resetToken,
      resetExpiresAt,
      updatedAt: new Date(),
    }).where(eq(portalAccounts.id, account.id));

    // TODO: Send email with reset link
    console.log(`[portal-forgot] Reset link generated for ${email}`);

    return NextResponse.json({ message: "Om e-postadressen finns skickas en återställningslänk" });
  } catch (err: any) {
    console.error("[portal-forgot]", err);
    return NextResponse.json({ error: "Serverfel" }, { status: 500 });
  }
}
