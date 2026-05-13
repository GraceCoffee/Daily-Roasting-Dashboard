import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, verifySessionToken } from "@/lib/auth";
import { calculateSnapshot } from "@/lib/calc";
import { upsertSnapshot, type SnapshotPayload } from "@/lib/db";
import { SAVED_SEARCH_IDS, fetchSavedSearch } from "@/lib/netsuite";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const dashboardPassword = process.env.DASHBOARD_PASSWORD;
  if (!cronSecret) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured" },
      { status: 500 },
    );
  }

  if (!(await isAuthorized(req, cronSecret, dashboardPassword))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const [roast, pack, inventory] = await Promise.all([
      fetchSavedSearch(SAVED_SEARCH_IDS.roast),
      fetchSavedSearch(SAVED_SEARCH_IDS.pack),
      fetchSavedSearch(SAVED_SEARCH_IDS.inventory),
    ]);

    const calc = calculateSnapshot(roast, pack, inventory);
    const generatedAt = new Date().toISOString();
    const payload: SnapshotPayload = { generatedAt, ...calc };
    const snapshotDate = currentDateInNewYork();
    await upsertSnapshot(snapshotDate, payload);

    return NextResponse.json({
      ok: true,
      snapshotDate,
      generatedAt,
      blendCount: calc.blends.length,
      itemCount: calc.items.length,
      warnings: calc.warnings,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[/api/refresh] failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function currentDateInNewYork(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

async function isAuthorized(
  req: Request,
  cronSecret: string,
  dashboardPassword: string | undefined,
): Promise<boolean> {
  if (req.headers.get("authorization") === `Bearer ${cronSecret}`) return true;
  if (!dashboardPassword) return false;
  const token = readSessionCookie(req.headers.get("cookie"));
  if (!token) return false;
  return verifySessionToken(token, dashboardPassword);
}

function readSessionCookie(header: string | null): string | null {
  if (!header) return null;
  for (const part of header.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() !== SESSION_COOKIE_NAME) continue;
    return decodeURIComponent(part.slice(eq + 1).trim());
  }
  return null;
}
