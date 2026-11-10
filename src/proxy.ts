import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Next 16 "proxy" (formerly middleware). It only checks that a session cookie
// exists so signed-out visitors land on /login; real auth happens server-side
// (requireAuth() in every page, authorize()/getUserFromToken() in API routes).
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow login page, auth API, and static assets
  if (
    pathname === "/login" ||
    pathname === "/forgot-password" ||
    pathname.startsWith("/api/auth/") ||
    pathname.startsWith("/_next/") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get("session_token")?.value;
  if (!token) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
