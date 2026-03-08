import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { apiKeys, bookingRequestLog } from "@/lib/db/schemas";
import { eq, and } from "drizzle-orm";

export interface ApiKeyValidationResult {
  valid: boolean;
  apiKeyId?: string;
  error?: string;
}

/**
 * Validates an API key from the Authorization: Bearer <key> header.
 * Hashes the key and looks it up in the database.
 */
export async function validateApiKey(
  request: NextRequest,
  requiredScope = "booking:write",
): Promise<ApiKeyValidationResult> {
  const authHeader = request.headers.get("authorization");
  const apiKeyHeader = request.headers.get("x-api-key");

  const rawKey = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : apiKeyHeader ?? null;

  if (!rawKey) {
    return { valid: false, error: "API key krävs" };
  }

  // Hash the key using Web Crypto API
  const encoder = new TextEncoder();
  const data = encoder.encode(rawKey);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const keyHash = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const [key] = await db
    .select()
    .from(apiKeys)
    .where(and(eq(apiKeys.keyHash, keyHash), eq(apiKeys.isActive, true)))
    .limit(1);

  if (!key) {
    return { valid: false, error: "Ogiltig API-nyckel" };
  }

  // Check expiry
  if (key.expiresAt && new Date(key.expiresAt) < new Date()) {
    return { valid: false, error: "API-nyckeln har gått ut" };
  }

  // Check scope
  if (!key.scopes?.includes(requiredScope)) {
    return { valid: false, error: "API-nyckeln saknar behörighet" };
  }

  // Check origin if key has origin restrictions
  const origin = request.headers.get("origin");
  if (key.allowedOrigins && key.allowedOrigins.length > 0 && origin) {
    if (!key.allowedOrigins.includes(origin)) {
      return { valid: false, error: "Ursprunget är inte tillåtet" };
    }
  }

  // Update last_used_at (fire and forget)
  db.update(apiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiKeys.id, key.id))
    .catch(() => {});

  return { valid: true, apiKeyId: key.id };
}
