# Project Context — Daily Roasting Dashboard

This folder is the canonical project context for the Daily Roasting Dashboard. It captures decisions, architecture, and progress so the work can be picked up cold without scrolling chat history.

## Current status

**Active phase: Phase 7 — SKU parser + calc with unit tests.**

Phase 6 done: Next.js (App Router + TS + Tailwind v4) is scaffolded in-place. `lib/db.ts` provides typed `@vercel/postgres` helpers; `migrations/0001_init_snapshots.sql` plus `scripts/migrate.ts` (run via `npm run db:migrate`) create a `snapshots(snapshot_date PK, created_at, payload JSONB)` table. Dev server compiles clean and serves 200. `.env.example` updated with `POSTGRES_URL`, `DASHBOARD_PASSWORD`, `CRON_SECRET`.

NetSuite-side work fully complete. All three saved searches return clean structured data via the RESTlet (Phase 5 verified end-to-end). Today's manual calc numbers (Daily Grace: 0 to roast, 3 to bag · Remmi Blend: 3 to roast, 3 to bag) match operational reality — Ryan confirmed. Real response bodies are saved as fixtures under [fixtures/](../fixtures/) and become the baseline for Phase 7 unit tests.

**Owner of next action:** Claude — Phase 7 (`lib/sku.ts` + `lib/calc.ts` + Vitest tests against the fixtures). Postgres client choice is settled (Neon serverless).

**Open non-blocking follow-up:** Add a `Subsidiary = Grace Coffee Roasters LLC` filter to saved search 3084 to mirror the original report's scope (NetSuite is OneWorld). Can happen in parallel with Phase 2; must be done before the Phase 5 smoke test.

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
