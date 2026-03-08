/**
 * LocalStorage cache for vehicle lookups.
 * TTL: 7 days, max 500 entries, LRU eviction.
 */

const CACHE_KEY = "jm_vehicle_cache";
const TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const MAX_ENTRIES = 500;

interface CacheEntry<T> {
  data: T;
  ts: number; // timestamp
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
    // Storage full — clear old entries
    try {
      localStorage.removeItem(CACHE_KEY);
    } catch {}
  }
}

function evictOldest(store: CacheStore) {
  const entries = Object.entries(store).sort((a, b) => a[1].ts - b[1].ts);
  while (entries.length > MAX_ENTRIES) {
    const [key] = entries.shift()!;
    delete store[key];
  }
}

export function getCachedVehicle<T = unknown>(regNr: string): T | null {
  const store = getStore();
  const key = regNr.toUpperCase().replace(/\s/g, "");
  const entry = store[key];

  if (!entry) return null;
  if (Date.now() - entry.ts > TTL_MS) {
    // Expired — remove
    delete store[key];
    saveStore(store);
    return null;
  }

  // Update access time (LRU)
  entry.ts = Date.now();
  saveStore(store);
  return entry.data as T;
}

export function setCachedVehicle<T = unknown>(regNr: string, data: T): void {
  const store = getStore();
  const key = regNr.toUpperCase().replace(/\s/g, "");

  store[key] = { data, ts: Date.now() };
  evictOldest(store);
  saveStore(store);
}

export function clearVehicleCache(): void {
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch {}
}
