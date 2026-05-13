# Project Context — Daily Roasting Dashboard

This folder is the canonical project context for the Daily Roasting Dashboard. It captures decisions, architecture, and progress so the work can be picked up cold without scrolling chat history.

## Current status

**🚀 Shipped. Production URL: https://daily-roasting-dashboard.vercel.app/** — awaiting first automated cron cycle (next 5am EDT).

Phase 9 done: Edge-runtime middleware ([`middleware.ts`](../middleware.ts)) gates everything except `/login`, `/api/login`, `/api/logout`, and `/api/refresh` (which has its own bearer-token gate). Session is an HMAC-SHA256 cookie signed with `DASHBOARD_PASSWORD` (so rotating it invalidates all sessions), Web-Crypto based for edge compatibility, 30-day expiry, HttpOnly + SameSite=Lax. Dashboard page ([`app/page.tsx`](../app/page.tsx)) is server-rendered, reads the latest snapshot, renders two tables + warnings banner + empty/error states.

Phase 10 done: Vercel project linked to `GraceCoffee/Daily-Roasting-Dashboard` under the **Grace Coffee Official** team. Neon Postgres attached via Vercel's native integration (env-var prefix set to `DATABASE` so vars are `DATABASE_URL` / `DATABASE_URL_UNPOOLED`). 9 env vars set in Vercel (3 non-sensitive NetSuite IDs across all envs; 4 NetSuite TBA secrets + `DASHBOARD_PASSWORD` + `CRON_SECRET` sensitive on Production+Preview). Migration applied to prod Neon via `npm run db:migrate` after fixing the runner to split multi-statement SQL files (Neon HTTP driver only accepts one statement per call). First manual seed via `/api/refresh` returned `{ ok: true, blendCount: 3, itemCount: 5, warnings: [] }` and Ryan confirmed the numbers match operational expectation in-browser.

**Open follow-up:** Verify the 09:00 UTC cron fires tomorrow morning and a fresh `2026-05-13`-dated snapshot lands. Passive — just check the dashboard tomorrow morning. If it doesn't, dig into Vercel → Logs → Cron Jobs.

**Other follow-ups (none blocking):**
- Saved search 3084 Subsidiary filter — ✅ done during Phase 10.

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
