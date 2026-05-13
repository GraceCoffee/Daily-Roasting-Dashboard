# Project Context — Daily Roasting Dashboard

This folder is the canonical project context for the Daily Roasting Dashboard. It captures decisions, architecture, and progress so the work can be picked up cold without scrolling chat history.

## Current status

**🚀 Shipped. Production URL: https://daily-roasting-dashboard.vercel.app/**

Phases 1–10 walked the build from "decide the stack" to "live in production." Phases 11 + 12 are post-ship UI extensions added the same evening: a historical date selector (`?date=YYYY-MM-DD` with prev/next arrows + native date input) and Grace brand styling (brand blue `#2b27e7` defined as a Tailwind theme variable, applied to table headers, action-column emphasis, and row hover; GC logo at [`public/gc-logo.svg`](../public/gc-logo.svg) rendered top-center on every page). Phase 13 added a "Refresh now" button next to Sign out that calls `/api/refresh` on demand — the same endpoint Vercel Cron hits — gated by the user's existing session cookie (the route now accepts either Bearer `CRON_SECRET` for cron or a valid `dashboard_session` cookie for logged-in users).

The full backend pipeline is verified end-to-end: NetSuite RESTlet → calc → Neon snapshot → server-rendered dashboard. First manual seed via `/api/refresh` returned `{ ok: true, blendCount: 3, itemCount: 5, warnings: [] }` and Ryan confirmed the numbers match operational expectation.

**Open follow-ups:**
- ⏳ **Verify the 09:00 UTC cron fires tomorrow morning** (= 5am EDT) and a fresh `2026-05-13`-dated snapshot lands. Passive — just open the dashboard tomorrow morning. If it doesn't, dig into Vercel → Logs → Cron Jobs.
- 🅿️ **Shopify integration deferred** — Ryan wants team feedback before picking SSO-via-OAuth vs. embedded-Shopify-App. Not started.
- (Optional) The provided `public/gc-logo.svg` is a PNG-wrapped-in-SVG (raster export with .svg extension). Display works fine; swap for a true vector if/when one exists.

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
