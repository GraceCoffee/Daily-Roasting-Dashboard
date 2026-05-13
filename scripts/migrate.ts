import { neon } from "@neondatabase/serverless";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const MIGRATIONS_DIR = join(process.cwd(), "migrations");

async function main() {
  const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
  if (!url) {
    console.error(
      "DATABASE_URL is not set. Locally: `vercel env pull .env`, then re-run.",
    );
    process.exit(1);
  }
  const sql = neon(url);

  await sql`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `;

  const appliedRows = (await sql`
    SELECT filename FROM schema_migrations
  `) as Array<{ filename: string }>;
  const applied = new Set(appliedRows.map((r) => r.filename));

  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    if (applied.has(file)) {
      console.log(`-- skip  ${file}`);
      continue;
    }
    const sqlText = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
    console.log(`-- apply ${file}`);
    await sql.query(sqlText);
    await sql`INSERT INTO schema_migrations (filename) VALUES (${file})`;
  }

  console.log("migrations: done");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
