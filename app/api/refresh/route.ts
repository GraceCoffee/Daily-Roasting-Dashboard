import { NextResponse } from "next/server";
import { calculateSnapshot } from "@/lib/calc";
import { upsertSnapshot, type SnapshotPayload } from "@/lib/db";
import { SAVED_SEARCH_IDS, fetchSavedSearch } from "@/lib/netsuite";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const expected = process.env.CRON_SECRET;
  if (!expected) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured" },
      { status: 500 },
    );
  }
  if (req.headers.get("authorization") !== `Bearer ${expected}`) {
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
