import { neon, type NeonQueryFunction } from "@neondatabase/serverless";

let _sql: NeonQueryFunction<false, false> | null = null;

export function sql(): NeonQueryFunction<false, false> {
  if (_sql) return _sql;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Locally: `vercel env pull .env`. On Vercel: set in the Storage tab.",
    );
  }
  _sql = neon(url);
  return _sql;
}

export type SnapshotPayload = {
  generatedAt: string;
  blends: BlendRow[];
  items: ItemRow[];
  warnings: string[];
};

export type BlendRow = {
  blend: string;
  howMuchToRoastLbs: number;
  howMuchToBagLbs: number;
  neededLbs: number;
  committedLbs: number;
  roastingLbs: number;
  toRoastOrPackLbs: number;
};

export type ItemRow = {
  item: string;
  unit: string;
  unitsSold: number;
  unitsCommitted: number;
  unitsNotRoasted: number;
  unitsInRoasting: number;
  unitsToAssemble: number;
};

type SnapshotDbRow = {
  snapshot_date: string | Date;
  created_at: string | Date;
  payload: SnapshotPayload;
};

export async function getLatestSnapshot(): Promise<{
  snapshotDate: string;
  createdAt: string;
  payload: SnapshotPayload;
} | null> {
  const rows = (await sql()`
    SELECT snapshot_date, created_at, payload
    FROM snapshots
    ORDER BY snapshot_date DESC
    LIMIT 1
  `) as SnapshotDbRow[];
  if (rows.length === 0) return null;
  return normalizeRow(rows[0]);
}

function normalizeRow(row: SnapshotDbRow): {
  snapshotDate: string;
  createdAt: string;
  payload: SnapshotPayload;
} {
  return {
    snapshotDate:
      row.snapshot_date instanceof Date
        ? row.snapshot_date.toISOString().slice(0, 10)
        : row.snapshot_date,
    createdAt:
      row.created_at instanceof Date
        ? row.created_at.toISOString()
        : row.created_at,
    payload: row.payload,
  };
}

export async function getSnapshotByDate(date: string): Promise<{
  snapshotDate: string;
  createdAt: string;
  payload: SnapshotPayload;
} | null> {
  const rows = (await sql()`
    SELECT snapshot_date, created_at, payload
    FROM snapshots
    WHERE snapshot_date = ${date}
  `) as SnapshotDbRow[];
  if (rows.length === 0) return null;
  return normalizeRow(rows[0]);
}

export async function getSnapshotDateBoundaries(date: string): Promise<{
  prev: string | null;
  next: string | null;
  earliest: string | null;
  latest: string | null;
}> {
  const rows = (await sql()`
    SELECT
      (SELECT snapshot_date FROM snapshots WHERE snapshot_date < ${date} ORDER BY snapshot_date DESC LIMIT 1) AS prev,
      (SELECT snapshot_date FROM snapshots WHERE snapshot_date > ${date} ORDER BY snapshot_date ASC LIMIT 1) AS next,
      (SELECT MIN(snapshot_date) FROM snapshots) AS earliest,
      (SELECT MAX(snapshot_date) FROM snapshots) AS latest
  `) as Array<{
    prev: string | Date | null;
    next: string | Date | null;
    earliest: string | Date | null;
    latest: string | Date | null;
  }>;
  const row = rows[0];
  const toIso = (v: string | Date | null) =>
    v === null ? null : v instanceof Date ? v.toISOString().slice(0, 10) : v;
  return {
    prev: toIso(row.prev),
    next: toIso(row.next),
    earliest: toIso(row.earliest),
    latest: toIso(row.latest),
  };
}

export async function upsertSnapshot(
  snapshotDate: string,
  payload: SnapshotPayload,
): Promise<void> {
  await sql()`
    INSERT INTO snapshots (snapshot_date, payload)
    VALUES (${snapshotDate}, ${JSON.stringify(payload)}::jsonb)
    ON CONFLICT (snapshot_date)
    DO UPDATE SET payload = EXCLUDED.payload, created_at = now()
  `;
}
