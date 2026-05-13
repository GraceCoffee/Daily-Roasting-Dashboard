import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth";

const PUBLIC_PATHS = new Set([
  "/login",
  "/api/login",
  "/api/logout",
  "/api/refresh",
]);

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC_PATHS.has(pathname)) return NextResponse.next();

  const password = process.env.DASHBOARD_PASSWORD;
  if (!password) {
    return NextResponse.json(
      { error: "DASHBOARD_PASSWORD is not configured" },
      { status: 500 },
    );
  }

  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const ok = token ? await verifySessionToken(token, password) : false;
  if (ok) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  const params = new URLSearchParams();
  if (pathname !== "/") params.set("from", pathname);
  url.search = params.toString();
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
