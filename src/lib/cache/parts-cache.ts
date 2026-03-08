/**
 * LocalStorage cache for parts catalog search results.
 * TTL: 5 minutes (stock changes more often than vehicle data).
 */

const CACHE_KEY = "jm_parts_cache";
const TTL_MS = 5 * 60 * 1000; // 5 minutes

interface CacheEntry<T> {
  data: T;
  ts: number;
}

type CacheStore = Record<string, CacheEntry<unknown>>;

function getStore(): CacheStore {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveStore(store: CacheStore) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(store));
  } catch {
    try { localStorage.removeItem(CACHE_KEY); } catch {}
  }
}

export function getCachedParts<T = unknown>(searchTerm: string): T | null {
  const store = getStore();
  const key = searchTerm.toLowerCase().trim();
  const entry = store[key];

  if (!entry) return null;
  if (Date.now() - entry.ts > TTL_MS) {
    delete store[key];
    saveStore(store);
    return null;
  }

  return entry.data as T;
}

export function setCachedParts<T = unknown>(searchTerm: string, data: T): void {
  const store = getStore();
  const key = searchTerm.toLowerCase().trim();

  // Keep max 50 search entries
  const keys = Object.keys(store);
  if (keys.length > 50) {
    const sorted = keys
      .map((k) => ({ k, ts: store[k].ts }))
      .sort((a, b) => a.ts - b.ts);
    for (let i = 0; i < keys.length - 40; i++) {
      delete store[sorted[i].k];
    }
  }

  store[key] = { data, ts: Date.now() };
  saveStore(store);
}

export function clearPartsCache(): void {
  try { localStorage.removeItem(CACHE_KEY); } catch {}
}
