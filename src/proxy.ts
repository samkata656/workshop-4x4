/**
 * First line of defence for /admin: no session cookie -> login page.
 * (Each admin page and every admin server action checks the session again;
 * see src/lib/admin/session.ts.)
 */
import { NextResponse } from "next/server";
import { auth } from "@/auth";

export const proxy = auth((request) => {
  const isLogin = request.nextUrl.pathname === "/admin/login";
  if (!request.auth && !isLogin) {
    return NextResponse.redirect(new URL("/admin/login", request.nextUrl));
  }
  if (request.auth && isLogin) {
    return NextResponse.redirect(new URL("/admin", request.nextUrl));
  }
  return NextResponse.next();
});

export const config = { matcher: ["/admin/:path*"] };
