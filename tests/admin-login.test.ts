import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { checkAdminLogin } from "@/lib/admin/login";
import { hashPassword } from "@/lib/admin/password";
import { isLockedOut, recordFailure, resetFailures } from "@/lib/admin/rate-limit";

const EMAIL = "owner@example.bg";
const PASSWORD = "correct horse battery staple";

beforeEach(() => {
  vi.stubEnv("ADMIN_EMAIL", EMAIL);
  vi.stubEnv("ADMIN_PASSWORD_HASH", hashPassword(PASSWORD));
});

afterEach(() => {
  vi.unstubAllEnvs();
  resetFailures();
});

describe("admin login check (every sign-in path ends here)", () => {
  it("lets the right e-mail and password in", () => {
    expect(checkAdminLogin({ email: ` ${EMAIL.toUpperCase()} `, password: PASSWORD }, "1.2.3.4")).toMatchObject({ id: "admin", email: EMAIL });
  });

  it("refuses a wrong password, a wrong e-mail and missing fields", () => {
    expect(checkAdminLogin({ email: EMAIL, password: "wrong" }, "1.2.3.4")).toBeNull();
    expect(checkAdminLogin({ email: "other@example.bg", password: PASSWORD }, "1.2.3.4")).toBeNull();
    expect(checkAdminLogin({ email: EMAIL }, "1.2.3.4")).toBeNull();
    expect(checkAdminLogin(undefined, "1.2.3.4")).toBeNull();
  });

  it("locks an address out after 5 wrong tries, even for the right password", () => {
    for (let i = 0; i < 5; i++) expect(checkAdminLogin({ email: EMAIL, password: `guess-${i}` }, "6.6.6.6")).toBeNull();
    expect(isLockedOut("6.6.6.6")).toBe(true);
    expect(checkAdminLogin({ email: EMAIL, password: PASSWORD }, "6.6.6.6")).toBeNull();
    // Another address is not affected.
    expect(checkAdminLogin({ email: EMAIL, password: PASSWORD }, "7.7.7.7")).not.toBeNull();
  });

  it("lifts the lockout after 15 minutes", () => {
    const start = Date.now();
    for (let i = 0; i < 5; i++) recordFailure("8.8.8.8", start);
    expect(isLockedOut("8.8.8.8", start + 14 * 60_000)).toBe(true);
    expect(isLockedOut("8.8.8.8", start + 16 * 60_000)).toBe(false);
  });

  it("keeps a lockout when thousands of other addresses fail afterwards", () => {
    for (let i = 0; i < 5; i++) recordFailure("9.9.9.9");
    for (let i = 0; i < 4000; i++) recordFailure(`flood-${i}`);
    expect(isLockedOut("9.9.9.9")).toBe(true);
  });
});
