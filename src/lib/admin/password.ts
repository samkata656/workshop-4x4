/**
 * Admin password hashing with scrypt (built into Node, no extra dependency).
 *
 * Stored format:  <salt hex>:<hash hex>
 * Deliberately free of "$" so it survives .env files and docker-compose
 * variable substitution without escaping (bcrypt hashes do not).
 */
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const KEY_LENGTH = 64;

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  return `${salt.toString("hex")}:${scryptSync(password, salt, KEY_LENGTH).toString("hex")}`;
}

/** Constant-time comparison; false for a malformed stored hash. */
export function verifyPassword(password: string, stored: string | undefined): boolean {
  const [saltHex, hashHex] = (stored ?? "").split(":");
  if (!saltHex || !hashHex || hashHex.length !== KEY_LENGTH * 2) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = scryptSync(password, Buffer.from(saltHex, "hex"), KEY_LENGTH);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

/** Compares two strings without leaking where they differ. */
export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
