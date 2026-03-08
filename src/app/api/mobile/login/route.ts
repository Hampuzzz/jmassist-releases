import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { authAccounts, userProfiles } from "@/lib/db/schemas";
import { eq, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { SignJWT } from "jose";

const SECRET = new TextEncoder().encode(
  process.env.NEXTAUTH_SECRET ?? "fallback-secret"
);

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "E-post och lösenord krävs" },
        { status: 400 }
      );
    }

    // Look up account by email (case-insensitive)
    const emailLower = email.toLowerCase();
    const account = await db.query.authAccounts.findFirst({
      where: sql`lower(${authAccounts.email}) = ${emailLower}`,
    });
    if (!account) {
      return NextResponse.json(
        { error: "Felaktig e-post eller lösenord" },
        { status: 401 }
      );
    }

    // Verify password
    const valid = await bcrypt.compare(password, account.passwordHash);
    if (!valid) {
      return NextResponse.json(
        { error: "Felaktig e-post eller lösenord" },
        { status: 401 }
      );
    }

    // Load user profile
    const profile = account.userId
      ? await db.query.userProfiles.findFirst({
          where: eq(userProfiles.id, account.userId),
        })
      : null;

    // Check is_active
    if (profile && !profile.isActive) {
      return NextResponse.json(
        { error: "Kontot är inaktiverat" },
        { status: 403 }
      );
    }

    const user = {
      id: account.userId ?? account.id,
      email: account.email,
      name: profile?.fullName ?? account.email,
      role: profile?.role ?? "mechanic",
      isActive: profile?.isActive ?? true,
      userType: profile?.userType ?? "intern",
      company: profile?.company ?? null,
    };

    // Create JWT token (7 days)
    const token = await new SignJWT({
      sub: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      userType: user.userType,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("7d")
      .sign(SECRET);

    return NextResponse.json({ user, token });
  } catch (err: any) {
    console.error("[mobile-login] Error:", err);
    return NextResponse.json(
      { error: "Serverfel vid inloggning", detail: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}
