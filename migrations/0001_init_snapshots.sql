CREATE TABLE IF NOT EXISTS snapshots (
  snapshot_date date PRIMARY KEY,
  created_at    timestamptz NOT NULL DEFAULT now(),
  payload       jsonb       NOT NULL
);

CREATE INDEX IF NOT EXISTS snapshots_created_at_idx
  ON snapshots (created_at DESC);
