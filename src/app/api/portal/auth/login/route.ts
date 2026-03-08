import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { portalAccounts, customers } from "@/lib/db/schemas";
import { sql, eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { signPortalToken, getCustomerName } from "@/lib/portal/auth";

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();
    if (!email || !password) {
      return NextResponse.json({ error: "E-post och lösenord krävs" }, { status: 400 });
    }

    // Find portal account + customer via join
    const rows = await db
      .select()
      .from(portalAccounts)
      .innerJoin(customers, eq(portalAccounts.customerId, customers.id))
      .where(sql`lower(${portalAccounts.email}) = ${email.toLowerCase()}`)
      .limit(1);

    if (rows.length === 0) {
      return NextResponse.json({ error: "Felaktig e-post eller lösenord" }, { status: 401 });
    }

    const account = rows[0].portal_accounts;
    const customer = rows[0].customers;

    if (!account.passwordHash || !account.isActive) {
      return NextResponse.json({ error: "Felaktig e-post eller lösenord" }, { status: 401 });
    }

    const valid = await bcrypt.compare(password, account.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: "Felaktig e-post eller lösenord" }, { status: 401 });
    }

    // Update last login
    await db.update(portalAccounts).set({ lastLoginAt: new Date() }).where(eq(portalAccounts.id, account.id));

    const name = getCustomerName(customer);
    const token = await signPortalToken({
      sub: account.id,
      customerId: account.customerId,
      email: account.email,
      name,
    });

    return NextResponse.json({
      token,
      user: { id: account.customerId, name, email: account.email, phone: customer.phone },
    });
  } catch (err: any) {
    console.error("[portal-login]", err);
    return NextResponse.json({ error: "Serverfel" }, { status: 500 });
  }
}
