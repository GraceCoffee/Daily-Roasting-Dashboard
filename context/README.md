# Project Context — Daily Roasting Dashboard

This folder is the canonical project context for the Daily Roasting Dashboard. It captures decisions, architecture, and progress so the work can be picked up cold without scrolling chat history.

## Current status

**Active phase: Phase 9 — dashboard page + password gate.**

Phase 7 done: `lib/sku.ts` (parseSku — null for off-pattern) and `lib/calc.ts` (`calculateSnapshot()`, per-column formula-fingerprint validation that fails loud on schema drift, pack size from the package report's `unit` column not the SKU). Vitest verifies the Phase 5 baseline byte-for-byte against `fixtures/expected_calc_output.json` (which was realigned to `SnapshotPayload` key names so calc output is what gets persisted with no translation layer). 13 tests pass.

Phase 8 done: `lib/netsuite.ts` exposes a typed `fetchSavedSearch()` that ports the smoke-test OAuth 1.0a + HMAC-SHA256 signing, with a 30s AbortController and clear error reporting. `app/api/refresh/route.ts` (Bearer `CRON_SECRET`-gated) fetches all three searches in parallel, runs the calc, upserts the snapshot keyed by today's date in `America/New_York`. `vercel.json` schedules it daily at `0 9 * * *` UTC (= 4am EST · 5am EDT — accepted DST drift). `npm run build` confirms `/api/refresh` is registered as a dynamic Node-runtime route.

**Owner of next action:** Claude — Phase 9 (server-rendered dashboard page reading the latest snapshot + middleware password gate via `DASHBOARD_PASSWORD`).

**Open non-blocking follow-up:** Add a `Subsidiary = Grace Coffee Roasters LLC` filter to saved search 3084 to mirror the original report's scope (NetSuite is OneWorld). Must be done before the Phase 10 production deploy so live numbers match Ryan's reference report.

## Quick decisions summary

| Decision | Choice |
|---|---|
| Hosting | Vercel |
| Framework | Next.js (App Router) + TypeScript |
| Persistence | Neon Postgres (Vercel native integration) via `@neondatabase/serverless`, **history retained** |
| Refresh cadence | Daily, 4:00am EST (via Vercel Cron) |
| NetSuite integration | **RESTlet (SuiteScript 2.1) + TBA (OAuth 1.0a)** — chosen over SuiteQL so existing saved searches remain the source of truth |
| Auth on dashboard | **Password-protected** (single shared password via env var) |
| Repo layout | Next.js scaffolded **in-place at the repo root** (single `package.json`) — keeps `netsuite/`, `scripts/`, `fixtures/`, `context/` siblings to `app/`, `lib/`, `migrations/` |
| Snapshot shape | **One row per day in `snapshots`, full calc output as JSONB `payload`** — trivial schema, easy to evolve calc output without migrations; ad-hoc history queries via JSONB operators if ever needed |

## Documents in this folder

- [README.md](README.md) — this file: current status + index. Update the "Current status" section as we move between phases.
- [architecture.md](architecture.md) — technical reference: stack, NetSuite integration design, calc logic, SKU pattern.
- [phases.md](phases.md) — phase-by-phase build plan with progress markers.

## Working norms

- **NetSuite-side instructions are click-by-click**, not high-level — Ryan flagged that NetSuite's own docs are unreliable and prefers explicit menu paths. Walkthroughs live in chat (and key reference values get pulled into [architecture.md](architecture.md)).
- **Smoke tests before integration** — before wiring anything into the app, prove each piece in isolation (e.g., curl the RESTlet before the app calls it).
- **Saved searches are the source of truth for business logic.** The app's only computed columns are "How much to roast" and "How much to bag" — everything else passes through unchanged.
