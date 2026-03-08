/**
 * Simple in-memory server-side cache with TTL.
 */

const cache = new Map<string, { value: any; expiresAt: number }>();

/**
 * Get a cached value by key. Returns undefined if not found or expired.
 */
export function getCached<T = any>(key: string): T | undefined {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return undefined;
  }
  return entry.value as T;
}

/**
 * Set a cached value with TTL in seconds (default: 60s).
 */
export function setCache(key: string, value: any, ttlSeconds = 60): void {
  cache.set(key, {
    value,
    expiresAt: Date.now() + ttlSeconds * 1000,
  });
}

/**
 * Clear a specific key or the entire cache.
 */
export function clearCache(key?: string): void {
  if (key) {
    cache.delete(key);
  } else {
    cache.clear();
  }
}
