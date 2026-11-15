import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

/**
 * Fast, optimistic check: no session cookie → login page.
 * The real check (valid session, role, company) runs on the server for every page and action.
 */
export function proxy(request: NextRequest) {
  if (!getSessionCookie(request)) {
    const url = new URL("/login", request.url);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // Everything except login, the auth/SDK/health/metrics APIs and static files.
  matcher: ["/((?!login|api/|_next/|favicon.ico|.*\\.(?:svg|png|jpg|ico|css|js)$).*)"],
};
