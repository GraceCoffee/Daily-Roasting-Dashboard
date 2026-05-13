# Daily Roasting Dashboard

Web app for the Grace Coffee roastery that tells the team, every morning at 4am EST, exactly how much coffee to roast, grind, and bag for the day. Data sourced from NetSuite.

**Project context lives in [`context/`](context/)** — start there before making changes:

- [`context/README.md`](context/README.md) — current phase, key decisions
- [`context/architecture.md`](context/architecture.md) — stack, NetSuite integration, calc logic, SKU pattern
- [`context/phases.md`](context/phases.md) — phase-by-phase build plan with progress markers

## Local development

Prerequisites: Node 22+, a Vercel project linked to this repo (for `vercel env pull`), and access to the NetSuite integration credentials.

```bash
npm install
vercel env pull .env          # populates DATABASE_URL, NetSuite TBA secrets, etc.
npm run db:migrate            # creates the snapshots table on first run
npm run dev                   # http://localhost:3000
```

## Useful scripts

| Command | What it does |
|---|---|
| `npm run dev` | Next.js dev server |
| `npm run build` | Production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest — calc + SKU parser unit tests against captured RESTlet fixtures |
| `npm run db:migrate` | Apply pending SQL migrations from `migrations/` |
| `npm run smoke:restlet` | OAuth-1.0a-signed test call to the NetSuite RESTlet (see `scripts/test-restlet.mjs`) |

## Layout

```
app/          Next.js App Router (UI + /api routes)
lib/          db client, NetSuite client, sku parser, calc
migrations/   numbered SQL migrations
scripts/      one-off Node scripts (migrate, RESTlet smoke test)
netsuite/     SuiteScript 2.1 RESTlet (deployed to NetSuite File Cabinet)
fixtures/     real saved-search response bodies — calc-test baseline
context/      project docs (read these first)
```
