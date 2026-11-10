/**
 * Tiny in-memory fixed-window limiter for the agent API. One server process,
 * one caller (n8n) — no Redis needed. Counters reset when the app restarts.
 */
type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

export type RateLimit = { limit: number; windowMs: number };
export type RateResult = { allowed: boolean; retryAfterSec: number };

function current(key: string, now: number): Bucket | undefined {
  const bucket = buckets.get(key);
  if (bucket && bucket.resetAt <= now) {
    buckets.delete(key);
    return undefined;
  }
  return bucket;
}

/** Has this key used up its window? Does not count as a hit. */
export function isLimited(key: string, { limit }: RateLimit, now = Date.now()): RateResult {
  const bucket = current(key, now);
  if (!bucket || bucket.count < limit) return { allowed: true, retryAfterSec: 0 };
  return { allowed: false, retryAfterSec: Math.ceil((bucket.resetAt - now) / 1000) };
}

/** Counts one hit. `allowed` is false once the window is full. */
export function hit(key: string, { limit, windowMs }: RateLimit, now = Date.now()): RateResult {
  let bucket = current(key, now);
  if (!bucket) {
    if (buckets.size >= 5000) buckets.clear(); // never grow without bound
    bucket = { count: 0, resetAt: now + windowMs };
    buckets.set(key, bucket);
  }
  if (bucket.count >= limit) return { allowed: false, retryAfterSec: Math.ceil((bucket.resetAt - now) / 1000) };
  bucket.count += 1;
  return { allowed: true, retryAfterSec: 0 };
}

/** Tests only. */
export function resetRateLimits() {
  buckets.clear();
}
