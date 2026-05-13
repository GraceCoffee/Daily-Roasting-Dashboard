import { NextResponse } from "next/server";
import {
  SESSION_COOKIE_NAME,
  SESSION_DURATION_SECONDS,
  createSessionToken,
} from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const password = process.env.DASHBOARD_PASSWORD;
  if (!password) {
    return NextResponse.json(
      { error: "DASHBOARD_PASSWORD is not configured" },
      { status: 500 },
    );
  }

  const form = await req.formData();
  const supplied = String(form.get("password") ?? "");
  const from = String(form.get("from") ?? "");

  const origin = new URL(req.url).origin;

  if (supplied !== password) {
    const failUrl = new URL("/login", origin);
    failUrl.searchParams.set("error", "1");
    if (isSafeRedirectPath(from)) failUrl.searchParams.set("from", from);
    return NextResponse.redirect(failUrl, { status: 303 });
  }

  const target = isSafeRedirectPath(from) ? from : "/";
  const okUrl = new URL(target, origin);
  const res = NextResponse.redirect(okUrl, { status: 303 });
  const token = await createSessionToken(password);
  res.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DURATION_SECONDS,
  });
  return res;
}

function isSafeRedirectPath(path: string): boolean {
  return Boolean(path) && path.startsWith("/") && !path.startsWith("//");
}
