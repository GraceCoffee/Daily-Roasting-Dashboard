# Build Phases

Status legend: ✅ done · 🟡 in progress · ⬜ pending

## NetSuite-side (must complete before app code)

### ✅ Phase 1 — Collect saved-search internal IDs

Done for two of three:
- `roastSearchId = 3062` ("GC - How Much Coffee to Roast?")
- `packageSearchId = 3083` ("GC - How Much Coffee to Package")
- `inventorySearchId` = TBD — see Phase 1.5.

Column-name corrections discovered during this phase (now reflected in [architecture.md](architecture.md)):
- `COFFEE TO ROAST OR PACK IN LBS` (not `SUM OF COFFEE TO ROAST OR PACK IN LBS`)
- `Units to Assemble` (not `Sum of Units to Assemble`)

### ✅ Phase 1.5 — Create "GC - Coffee Inventory" saved search

The originally-pointed-at "Custom Current Inventory Snapshot" turned out to be a Saved Report (id 323), not a Saved Search. SuiteScript's `search.load()` doesn't load Saved Reports, so a small parallel saved search was created.

**Outputs delivered:**
- `inventorySearchId = 3084`
- Single warehouse confirmed — no per-location handling needed in the calc.
- Original Saved Report filters: `Location = All` (no-op) and `Subsidiary = Grace Coffee Roasters LLC` (relevant — see follow-up below).

**Open follow-up (non-blocking for Phase 2):** Add a `Subsidiary = Grace Coffee Roasters LLC` filter to saved search 3084 so it matches the original report's scope. Walkthrough in chat.

### ✅ Phase 2 — Upload RESTlet to File Cabinet

`roasting_dashboard_restlet.js` uploaded to the SuiteScripts folder in NetSuite's File Cabinet. Contents verified to match the repo file.

### ✅ Phase 3 — Create Script + Deployment records

- Script record: `customscript3855` (Roasting Dashboard RESTlet, API version 2.1)
- Deployment: script=3855, deploy=1, Status = Released, Audience initially broad
- Custom Plug-In Types section was a UI quirk — left empty (unrelated to RESTlets)
- Deployment created via **Customization → Scripting → Script Deployments → New** (the Script record's Deployments tab in this NetSuite version is read-only; no inline-add)

Audience to be tightened to the dedicated integration role at the end of Phase 4.

### ✅ Phase 4 — Token-Based Auth setup

Sub-steps:
1. Enable TBA feature (Setup → Company → Enable Features → SuiteCloud) if not already on.
2. Create an Integration record (Setup → Integration → Manage Integrations) → outputs **Consumer Key + Consumer Secret** (shown once — must be captured immediately).
3. Create a dedicated role with permissions for REST Web Services + saved-search execution (least privilege).
4. Generate an Access Token tied to that role (Setup → Users/Roles → Access Tokens) → outputs **Token ID + Token Secret** (shown once — capture immediately).
5. Tighten the Phase 3 Deployment Audience to only the new role.

**Output:** four secrets stored as Vercel env vars (Consumer Key/Secret, Token ID/Secret).

### ✅ Phase 5 — Smoke test

Replaced curl with a tiny zero-dependency Node script (`scripts/test-restlet.mjs`) that handles the OAuth 1.0a + HMAC-SHA256 signing the same way the production app will. All three saved searches return successfully end-to-end.

**Lessons captured (now in [architecture.md](architecture.md)):**
- RESTlets live on `restlets.api.netsuite.com/app/site/hosting/restlet.nl`, **not** the SuiteTalk subdomain.
- Always send `Accept: application/json` — without it NetSuite returns a plain-text generic error envelope that hides the real problem.
- Subsidiary access on the integration role is required (silent zero-rows otherwise) in OneWorld accounts.
- For formula columns, SuiteScript's `column.label` doesn't expose the user-set Custom Label — identify columns by position + formula fingerprint instead.

**First calc check (manual, confirmed by Ryan):**
- Daily Grace: 3 lbs needed, 14.075 lbs bulk on hand → 0 to roast, 3 to bag ✅
- Remmi Blend: 3 lbs needed, 0 lbs bulk on hand → 3 to roast, 3 to bag ✅

Real saved-search response bodies from this Phase 5 verification are saved under [`fixtures/`](../fixtures/) and become the baseline for the calc unit tests in Phase 7.

## App-side

### ✅ Phase 6 — Scaffold Next.js app + Vercel Postgres

Scaffolded in-place at the repo root. App Router + TypeScript + Tailwind v4. Dev server boots clean and `GET /` returns 200 with a placeholder page.

**Delivered:**
- `package.json` / `tsconfig.json` / `next.config.ts` / `postcss.config.mjs`
- `app/{layout,page}.tsx` + `app/globals.css`
- `lib/db.ts` — typed `@neondatabase/serverless` helpers (`getLatestSnapshot`, `upsertSnapshot`) + `SnapshotPayload` / `BlendRow` / `ItemRow` types; lazy `sql()` factory so the dev server doesn't crash without `DATABASE_URL`
- `migrations/0001_init_snapshots.sql` — `snapshots(snapshot_date PK, created_at, payload JSONB)` + `created_at DESC` index
- `scripts/migrate.ts` — idempotent runner with `schema_migrations` tracking; uses `DATABASE_URL_UNPOOLED` when available (DDL prefers a direct connection); `npm run db:migrate`
- `.env.example` extended with `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `DASHBOARD_PASSWORD`, `CRON_SECRET`

**Decision recorded:** `@vercel/postgres` is deprecated (Vercel moved Postgres to Neon as a native integration). We swapped to `@neondatabase/serverless` immediately so we don't pay churn cost later. App-side queries use the pooled `DATABASE_URL`; the migration runner prefers the unpooled URL.

### ✅ Phase 7 — SKU parser + calc with unit tests

Pure functions in `lib/sku.ts` (parseSku returns null for off-pattern SKUs) and `lib/calc.ts` (`calculateSnapshot()`). Each saved search is validated by column count + per-column formula fingerprint so schema drift fails loud rather than silently mismapping. Pack size comes from the package report's `unit` column directly, not the SKU — sidesteps the inventory-vs-package SKU-convention inconsistency.

[`fixtures/expected_calc_output.json`](../fixtures/expected_calc_output.json) was realigned to `SnapshotPayload` key names (`howMuchToRoastLbs`, `neededLbs`, `unit`) so calc output is byte-equal to what gets persisted — no translation layer. Verified numeric values unchanged. 13 Vitest tests pass; `tsc --noEmit` clean.

### ✅ Phase 8 — NetSuite client + /api/refresh route + Vercel Cron

- [`lib/netsuite.ts`](../lib/netsuite.ts) — typed `fetchSavedSearch(id)` that ports the smoke-test's OAuth 1.0a + HMAC-SHA256 signing. 30s AbortController; clear error reporting (HTTP status, body preview, JSON-parse failures).
- [`app/api/refresh/route.ts`](../app/api/refresh/route.ts) — Bearer `CRON_SECRET`-gated GET handler that fetches all three saved searches in parallel, runs the calc, and upserts the snapshot keyed by today's `America/New_York` date.
- [`vercel.json`](../vercel.json) — cron at `0 9 * * *` (4am EST in standard time, 5am EDT in DST — accepted drift).

`npm run build` registers `/api/refresh` as a dynamic Node-runtime route. End-to-end validation against the real NetSuite + Neon happens in Phase 10 (needs prod env vars).

### ✅ Phase 9 — Dashboard page + password gate

- [`middleware.ts`](../middleware.ts) — edge-runtime gate on everything except `/login`, `/api/login`, `/api/logout`, `/api/refresh`. HMAC-SHA256 session cookie signed with `DASHBOARD_PASSWORD` via Web Crypto; rotating the password invalidates all sessions; constant-time compare; HttpOnly + SameSite=Lax + 30-day Max-Age.
- [`app/page.tsx`](../app/page.tsx) — server-rendered dashboard reading the latest snapshot via `getLatestSnapshot()`, rendering by-blend and by-item tables, warnings banner, empty/error states.
- [`app/login/page.tsx`](../app/login/page.tsx) + [`app/api/login/route.ts`](../app/api/login/route.ts) + [`app/api/logout/route.ts`](../app/api/logout/route.ts) — plain POST form; open-redirect guard on `from` param.

Verified end-to-end against dev server: unauth → 307 to /login; wrong pw → 303 to /login?error=1; right pw → 303 to / + cookie; tampered cookie → 307; /api/refresh stays bearer-gated.

### ✅ Phase 10 — Deploy to Vercel and verify end-to-end

- NetSuite saved search 3084: added `Subsidiary = Grace Coffee Roasters LLC` filter (carried over from Phase 1.5).
- Vercel project created under team **Grace Coffee Official**, linked to GitHub `GraceCoffee/Daily-Roasting-Dashboard` (auto-deploys on push to `main`).
- Neon Postgres attached via Vercel's native Neon integration with env-var prefix `DATABASE` (so vars are named `DATABASE_URL` / `DATABASE_URL_UNPOOLED`, matching our code).
- 9 production env vars set: 3 non-sensitive NetSuite IDs across all envs; 4 NetSuite TBA secrets + `DASHBOARD_PASSWORD` + `CRON_SECRET` marked Sensitive (Production + Preview only — Vercel disallows sensitive vars in Development).
- Migration runner ([`scripts/migrate.ts`](../scripts/migrate.ts)) updated to split multi-statement SQL files on `;` because Neon's serverless HTTP driver uses prepared statements (one statement per call).
- Production URL: **https://daily-roasting-dashboard.vercel.app/**
- First manual refresh via `/api/refresh` (Bearer `CRON_SECRET`): `{ ok: true, snapshotDate: "2026-05-12", blendCount: 3, itemCount: 5, warnings: [] }`. Ryan confirmed numbers in-browser match operational expectation.
- **Awaiting:** automated 09:00 UTC cron tomorrow morning (= 5am EDT) to write the first scheduled `2026-05-13` snapshot.

## Post-ship UI extensions

### ✅ Phase 11 — Historical date selector

`?date=YYYY-MM-DD` query param on the dashboard lets the team look back at past snapshots. New DB helpers [`getSnapshotByDate()`](../lib/db.ts) and [`getSnapshotDateBoundaries()`](../lib/db.ts) return the requested snapshot plus prev/next/earliest/latest neighbor dates in a single round trip.

Header date control: prev arrow + native date input + next arrow, plus a "Latest" button when not on the most recent snapshot. Arrows are constrained to dates we actually have. Invalid or missing date param falls through to the latest snapshot; picking a date with no recorded snapshot renders a contextual "no snapshot for {date}" empty state with a back-to-latest affordance. Date input is a tiny client component ([`app/_components/DatePicker.tsx`](../app/_components/DatePicker.tsx)) so onChange can navigate immediately.

### ✅ Phase 12 — Grace brand styling

- [`app/globals.css`](../app/globals.css) defines `--color-grace-blue: #2b27e7` via Tailwind v4's `@theme` so we can use `bg-grace-blue`, `text-grace-blue`, and opacity variants (`bg-grace-blue/5`, `/15`) anywhere.
- Table headers in both tables: solid grace-blue with white text.
- Action columns ("How much to roast" / "How much to bag" in the blend table, "To assemble" in the item table) have a faint grace-blue tint by default and bold blue numerals — so the action items pop visually vs. passthrough columns.
- Body rows highlight on hover via `group-hover`, with the action cells getting an extra-strong tint so they stay prominent.
- GC logo at [`public/gc-logo.svg`](../public/gc-logo.svg) is rendered top-center on every page in the root layout at 80×80px, wrapped in a link back to `/`. The asset is a PNG-wrapped-in-SVG (the design tool exported a raster image with .svg extension) — display is fine; can be swapped for a true vector later.

### ✅ Phase 13 — Manual refresh button

- [`app/_components/RefreshButton.tsx`](../app/_components/RefreshButton.tsx) (client component) sits next to "Sign out" in the dashboard header. On click it `fetch("/api/refresh")` same-origin (so the `dashboard_session` cookie rides along), then calls `router.refresh()` to re-render the page with the new snapshot. Shows a "Refreshing…" loading state and surfaces any error inline.
- [`app/api/refresh/route.ts`](../app/api/refresh/route.ts) now accepts **either** a Bearer `CRON_SECRET` header (for Vercel Cron) **or** a valid `dashboard_session` cookie (for logged-in users hitting the button). New `isAuthorized()` helper covers both paths; the route still upserts into the same `snapshots(snapshot_date PK)` row so an intra-day refresh overwrites the morning cron's snapshot for that date.
- Vercel Cron schedule **kept at daily** `0 9 * * *` — Hobby plan caps cron at one invocation per day, and the button covers ad-hoc intra-day needs. Could go hourly on Pro plan if/when desirable.

## Parked

### 🅿️ Shopify integration (deferred)

Ryan wants the team to access the dashboard via their Shopify login. Three possible flavors:
1. **SSO via Shopify OAuth** — replace the shared `DASHBOARD_PASSWORD` gate with "Sign in with Shopify." Lightest lift.
2. **Embedded Shopify App** — dashboard renders as a tab inside `admin.shopify.com`. Heaviest (App Bridge, iframe sandbox, embedded-app UX conventions).
3. **Public Shopify App Store listing** — almost certainly not what's wanted for an internal tool.

Deferred until the team weighs in on which flavor they want. Each is a multi-day project with external moving parts (Shopify Partner Dashboard setup, OAuth credentials, callback URLs).
