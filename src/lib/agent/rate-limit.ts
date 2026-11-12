/**
 * Tiny in-memory fixed-window limiter for the agent API. One server process,
 * one caller (n8n) — no Redis needed. Counters reset when the app restarts.
 */
type Bucket = { count: number; resetAt: number; shared: boolean };
const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 5000;

/** `shared`: one budget for all callers (a daily cost cap). It is never dropped to make room. */
export type RateLimit = { limit: number; windowMs: number; shared?: boolean };
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
/**
 * Keeps the map bounded without resetting the limits: expired buckets go first,
 * then the oldest per-caller ones (a Map iterates in insertion order). Shared
 * budgets stay, so flooding the map with addresses cannot reset a daily cap.
 */
function makeRoom(now: number) {
  for (const [key, bucket] of buckets) if (bucket.resetAt <= now) buckets.delete(key);
  let toDrop = buckets.size >= MAX_BUCKETS ? MAX_BUCKETS / 5 : 0;
  for (const [key, bucket] of buckets) {
    if (toDrop <= 0) break;
    if (bucket.shared) continue;
    buckets.delete(key);
    toDrop -= 1;
  }
}

export function hit(key: string, { limit, windowMs, shared }: RateLimit, now = Date.now()): RateResult {
  let bucket = current(key, now);
  if (!bucket) {
    if (buckets.size >= MAX_BUCKETS) makeRoom(now);
    bucket = { count: 0, resetAt: now + windowMs, shared: shared === true };
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
