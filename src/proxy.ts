import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_PATHS = [
  "/login",
  "/register",
  "/api/auth/",
  "/api/health",
  "/api/cron/",
];

export function proxy(request: NextRequest) {
  // Dev mode: skip proxy entirely (rely on session.ts dev bypass)
  if (process.env["NODE_ENV"] === "development") {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;

  // Allow public paths
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Allow static files and Next.js internals
  if (pathname.startsWith("/_next") || pathname.startsWith("/favicon")) {
    return NextResponse.next();
  }

  // Check for session cookie (lightweight — full JWT verification in getSession)
  const sessionCookie = request.cookies.get("safam-session");
  if (!sessionCookie?.value) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
