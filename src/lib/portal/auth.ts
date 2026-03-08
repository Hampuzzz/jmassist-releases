import { SignJWT, jwtVerify } from "jose";
import { db } from "@/lib/db";
import { portalAccounts, customers } from "@/lib/db/schemas";
import { eq } from "drizzle-orm";

const SECRET = new TextEncoder().encode(
  process.env.NEXTAUTH_SECRET ?? "fallback-portal-secret"
);

export interface PortalJwtPayload {
  sub: string; // portalAccount.id
  customerId: string;
  email: string;
  name: string;
}

/**
 * Sign a portal JWT token (30 days)
 */
export async function signPortalToken(payload: PortalJwtPayload): Promise<string> {
  return new SignJWT({
    sub: payload.sub,
    customerId: payload.customerId,
    email: payload.email,
    name: payload.name,
    scope: "portal",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(SECRET);
}

/**
 * Verify a portal JWT token.
 * Returns the payload or null if invalid.
 */
export async function verifyPortalToken(token: string): Promise<PortalJwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    if (payload.scope !== "portal" || !payload.sub || !payload.customerId) return null;
    return {
      sub: payload.sub as string,
      customerId: payload.customerId as string,
      email: payload.email as string,
      name: payload.name as string,
    };
  } catch {
    return null;
  }
}

/**
 * Extract and verify Bearer token from request.
 * Returns customer context or null.
 */
export async function getPortalCustomer(request: Request): Promise<PortalJwtPayload | null> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);
  return verifyPortalToken(token);
}

/**
 * Get the customer display name from a customer record.
 */
export function getCustomerName(customer: {
  isCompany: boolean;
  firstName: string | null;
  lastName: string | null;
  companyName: string | null;
}): string {
  if (customer.isCompany && customer.companyName) return customer.companyName;
  return [customer.firstName, customer.lastName].filter(Boolean).join(" ") || "Kund";
}
