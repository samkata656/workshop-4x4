/**
 * Tiny in-memory limiter for the login form: 5 failed tries per 15 minutes per
 * address. Enough for one admin on one server; it resets when the app restarts.
 */
const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 5;
const MAX_KEYS = 5000;
const failures = new Map<string, number[]>();

export function isLockedOut(key: string, now = Date.now()) {
  const recent = (failures.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  return recent.length >= MAX_FAILURES;
}

export function recordFailure(key: string, now = Date.now()) {
  const recent = (failures.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  failures.delete(key); // re-insert so the map stays ordered by latest failure
  failures.set(key, [...recent, now]);
  // Never grow without bound. Drop the addresses that failed longest ago, never
  // everything at once: clearing the map would let a flood of fake addresses
  // lift a real lockout.
  for (const oldest of failures.keys()) {
    if (failures.size <= MAX_KEYS) break;
    failures.delete(oldest);
  }
}

export function clearFailures(key: string) {
  failures.delete(key);
}

/** Tests only. */
export function resetFailures() {
  failures.clear();
}
