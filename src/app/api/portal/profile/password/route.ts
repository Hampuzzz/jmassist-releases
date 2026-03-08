import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { portalAccounts } from "@/lib/db/schemas";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { getPortalCustomer } from "@/lib/portal/auth";

export async function PUT(request: Request) {
  const customer = await getPortalCustomer(request);
  if (!customer) return NextResponse.json({ error: "Ej behörig" }, { status: 401 });

  try {
    const { current_password, new_password } = await request.json();
    if (!current_password || !new_password) {
      return NextResponse.json({ error: "Nuvarande och nytt lösenord krävs" }, { status: 400 });
    }
    if (new_password.length < 8) {
      return NextResponse.json({ error: "Lösenordet måste vara minst 8 tecken" }, { status: 400 });
    }

    const [account] = await db.select().from(portalAccounts).where(eq(portalAccounts.id, customer.sub)).limit(1);
    if (!account || !account.passwordHash) {
      return NextResponse.json({ error: "Konto hittades inte" }, { status: 404 });
    }

    const valid = await bcrypt.compare(current_password, account.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: "Felaktigt nuvarande lösenord" }, { status: 401 });
    }

    const passwordHash = await bcrypt.hash(new_password, 12);
    await db.update(portalAccounts).set({ passwordHash, updatedAt: new Date() }).where(eq(portalAccounts.id, account.id));

    return NextResponse.json({ message: "Lösenord ändrat" });
  } catch (err: any) {
    console.error("[portal-password]", err);
    return NextResponse.json({ error: "Serverfel" }, { status: 500 });
  }
}
