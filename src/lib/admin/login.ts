/**
 * The one place the admin password is checked.
 *
 * The lockout lives HERE, not in the login form's action: Auth.js also accepts
 * a login at POST /api/auth/callback/credentials, and both paths end up in this
 * function. A limit kept only in the form would not count the second path.
 */
import { safeEqual, verifyPassword } from "@/lib/admin/password";
import { isLockedOut, recordFailure } from "@/lib/admin/rate-limit";

export type AdminUser = { id: string; email: string; name: string };

export function checkAdminLogin(credentials: { email?: unknown; password?: unknown } | undefined, address: string): AdminUser | null {
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const email = typeof credentials?.email === "string" ? credentials.email.trim().toLowerCase() : "";
  const password = typeof credentials?.password === "string" ? credentials.password : "";
  if (!adminEmail || !email || !password) return null;

  // Locked out: refuse without looking at the password, so even the right one does not get in.
  if (isLockedOut(address)) return null;

  // Always run both checks so a wrong email takes as long as a wrong password.
  const emailOk = safeEqual(email, adminEmail);
  const passwordOk = verifyPassword(password, process.env.ADMIN_PASSWORD_HASH);
  if (emailOk && passwordOk) return { id: "admin", email: adminEmail, name: "Админ" };

  recordFailure(address);
  return null;
}
