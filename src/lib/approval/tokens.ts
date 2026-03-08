import { SignJWT, jwtVerify } from "jose";

let _secret: Uint8Array | null = null;
function getSecret(): Uint8Array {
  if (!_secret) {
    const value = process.env.APPROVAL_SECRET ?? process.env.ICAL_SECRET;
    if (!value) throw new Error("APPROVAL_SECRET or ICAL_SECRET environment variable is required");
    _secret = new TextEncoder().encode(value);
  }
  return _secret;
}

/**
 * Sign a token for public approval page access.
 * Token embeds the approvalRequestId and expires in 7 days.
 */
export async function signApprovalToken(approvalRequestId: string): Promise<string> {
  return new SignJWT({ sub: approvalRequestId, scope: "approval:view" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getSecret());
}

/**
 * Verify an approval token and return the approvalRequestId.
 * Returns null if invalid or expired.
 */
export async function verifyApprovalToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (payload.scope !== "approval:view" || typeof payload.sub !== "string") return null;
    return payload.sub;
  } catch {
    return null;
  }
}
