import { SignJWT, jwtVerify } from "jose";
import { db } from "@/lib/db";
import { portalAccounts, customers } from "@/lib/db/schemas";
import { eq } from "drizzle-orm";

let _portalSecret: Uint8Array | null = null;
function getPortalSecret(): Uint8Array {
  if (!_portalSecret) {
    if (!process.env.NEXTAUTH_SECRET) throw new Error("NEXTAUTH_SECRET environment variable is required");
    _portalSecret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET);
  }
  return _portalSecret;
}

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
    .sign(getPortalSecret());
}

/**
 * Verify a portal JWT token.
 * Returns the payload or null if invalid.
 */
export async function verifyPortalToken(token: string): Promise<PortalJwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getPortalSecret());
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
