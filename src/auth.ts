/**
 * Auth.js (next-auth v5) — one admin account.
 *
 * The email and the password HASH live in .env; the password itself is stored
 * nowhere. Sessions are signed cookies (JWT), so no session table is needed.
 */
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { checkAdminLogin } from "@/lib/admin/login";
import { clientAddress } from "@/lib/n8n";

export const { handlers, auth, signIn, signOut } = NextAuth({
  // We run behind our own reverse proxy in Docker, not on a managed host.
  trustHost: true,
  session: { strategy: "jwt", maxAge: 12 * 60 * 60 }, // one working day
  pages: { signIn: "/admin/login" },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      // The lockout is inside checkAdminLogin, so it also covers Auth.js's own
      // /api/auth/callback/credentials address, not only our login form.
      authorize: (credentials, request) => checkAdminLogin(credentials, clientAddress(request.headers)),
    }),
  ],
});
