/**
 * Auth.js (next-auth v5) — one admin account.
 *
 * The email and the password HASH live in .env; the password itself is stored
 * nowhere. Sessions are signed cookies (JWT), so no session table is needed.
 */
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { safeEqual, verifyPassword } from "@/lib/admin/password";

export const { handlers, auth, signIn, signOut } = NextAuth({
  // We run behind our own reverse proxy in Docker, not on a managed host.
  trustHost: true,
  session: { strategy: "jwt", maxAge: 12 * 60 * 60 }, // one working day
  pages: { signIn: "/admin/login" },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      authorize(credentials) {
        const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
        const email = typeof credentials?.email === "string" ? credentials.email.trim().toLowerCase() : "";
        const password = typeof credentials?.password === "string" ? credentials.password : "";
        if (!adminEmail || !email || !password) return null;

        // Always run both checks so a wrong email takes as long as a wrong password.
        const emailOk = safeEqual(email, adminEmail);
        const passwordOk = verifyPassword(password, process.env.ADMIN_PASSWORD_HASH);
        return emailOk && passwordOk ? { id: "admin", email: adminEmail, name: "Админ" } : null;
      },
    }),
  ],
});
