import { SignJWT, jwtVerify } from "jose";

const secret = new TextEncoder().encode(
  process.env.APPROVAL_SECRET ?? process.env.ICAL_SECRET ?? "fallback-approval-secret-change-in-production",
);

/**
 * Sign a token for public approval page access.
 * Token embeds the approvalRequestId and expires in 7 days.
 */
export async function signApprovalToken(approvalRequestId: string): Promise<string> {
  return new SignJWT({ sub: approvalRequestId, scope: "approval:view" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secret);
}

/**
 * Verify an approval token and return the approvalRequestId.
 * Returns null if invalid or expired.
 */
export async function verifyApprovalToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    if (payload.scope !== "approval:view" || typeof payload.sub !== "string") return null;
    return payload.sub;
  } catch {
    return null;
  }
}
