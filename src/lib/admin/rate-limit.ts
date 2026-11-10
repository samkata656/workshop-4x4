/**
 * Tiny in-memory limiter for the login form: 5 failed tries per 15 minutes per
 * address. Enough for one admin on one server; it resets when the app restarts.
 */
const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 5;
const failures = new Map<string, number[]>();

export function isLockedOut(key: string, now = Date.now()) {
  const recent = (failures.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  failures.set(key, recent);
  return recent.length >= MAX_FAILURES;
}

export function recordFailure(key: string, now = Date.now()) {
  failures.set(key, [...(failures.get(key) ?? []), now]);
  if (failures.size > 5000) failures.clear(); // never grow without bound
}

export function clearFailures(key: string) {
  failures.delete(key);
}
