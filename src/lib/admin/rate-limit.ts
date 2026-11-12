/**
 * Tiny in-memory limiter for the login form: 5 failed tries per 15 minutes per
 * address. Enough for one admin on one server; it resets when the app restarts.
 */
const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 5;
const MAX_KEYS = 5000;

// Kept on globalThis, not in a module variable: Next.js bundles the login form's
// server action and the /api/auth route separately, and each bundle gets its own
// copy of this module. A plain variable would give every sign-in path its own
// counter, so 5 tries would become 5 per path.
const store = globalThis as typeof globalThis & { __adminLoginFailures?: Map<string, number[]> };
const failures = (store.__adminLoginFailures ??= new Map<string, number[]>());

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
