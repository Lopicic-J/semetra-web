/**
 * API Response Cache — In-memory cache for expensive API computations
 *
 * Used for endpoints like /api/decision, /api/nudges, /api/briefing
 * where data doesn't change every second but is expensive to compute.
 *
 * Per-user keying ensures no data leaks.
 * TTL-based expiration with stale-while-revalidate pattern.
 */

interface CacheEntry<T> {
  data: T;
  createdAt: number;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry<unknown>>();

// Cleanup stale entries every 5 minutes
const CLEANUP_INTERVAL = 5 * 60 * 1000;
let lastCleanup = Date.now();

function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;

  for (const [key, entry] of cache) {
    // Remove entries older than 2x TTL (fully expired)
    if (now > entry.expiresAt + (entry.expiresAt - entry.createdAt)) {
      cache.delete(key);
    }
  }
}

/**
 * Get a cached value.
 *
 * @returns { data, isStale } if found, null if no cache entry
 */
export function getFromCache<T>(key: string): { data: T; isStale: boolean } | null {
  cleanup();

  const entry = cache.get(key) as CacheEntry<T> | undefined;
  if (!entry) return null;

  const now = Date.now();
  const isStale = now > entry.expiresAt;

  // Fully expired (2x TTL)
  const ttl = entry.expiresAt - entry.createdAt;
  if (now > entry.expiresAt + ttl) {
    cache.delete(key);
    return null;
  }

  return { data: entry.data, isStale };
}

/**
 * Store a value in cache.
 *
 * @param key     Cache key (should include userId for user-specific data)
 * @param data    Data to cache
 * @param ttlMs   Time-to-live in milliseconds (default 5 minutes)
 */
export function setInCache<T>(key: string, data: T, ttlMs = 5 * 60 * 1000): void {
  const now = Date.now();
  cache.set(key, {
    data,
    createdAt: now,
    expiresAt: now + ttlMs,
  });
}

/**
 * Invalidate cache entries matching a prefix.
 * Use after mutations that affect cached data.
 *
 * Example: invalidateCache(`user:${userId}:nudges`)
 */
export function invalidateCache(prefix: string): void {
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) {
      cache.delete(key);
    }
  }
}

/**
 * Build a user-scoped cache key.
 */
export function userCacheKey(userId: string, ...parts: string[]): string {
  return `user:${userId}:${parts.join(":")}`;
}

/**
 * Cache-or-compute pattern.
 *
 * Returns cached data if fresh, otherwise computes and caches.
 * If stale, returns stale data and recomputes in background.
 *
 * @param key      Cache key
 * @param compute  Async function to compute the value
 * @param ttlMs    Cache TTL (default 5 minutes)
 */
export async function cacheOrCompute<T>(
  key: string,
  compute: () => Promise<T>,
  ttlMs = 5 * 60 * 1000
): Promise<T> {
  const cached = getFromCache<T>(key);

  if (cached && !cached.isStale) {
    return cached.data;
  }

  if (cached && cached.isStale) {
    // Return stale data immediately, recompute in background
    compute()
      .then((fresh) => setInCache(key, fresh, ttlMs))
      .catch(console.error);
    return cached.data;
  }

  // No cache — compute fresh
  const fresh = await compute();
  setInCache(key, fresh, ttlMs);
  return fresh;
}

/**
 * Cache stats for monitoring.
 */
export function getCacheStats(): { entries: number; memoryEstimateKB: number } {
  let totalSize = 0;
  for (const [, entry] of cache) {
    totalSize += JSON.stringify(entry.data).length;
  }

  return {
    entries: cache.size,
    memoryEstimateKB: Math.round(totalSize / 1024),
  };
}
