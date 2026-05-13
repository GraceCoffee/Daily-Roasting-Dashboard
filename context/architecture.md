# Architecture

## Goal

Web app for the Grace Coffee roastery that tells the team, every morning at 4am EST, exactly how much coffee to roast, grind, and bag for the day. All data sourced from NetSuite.

## Stack

- **Framework:** Next.js (App Router) + TypeScript
- **Hosting:** Vercel
- **Persistence:** Neon Postgres via Vercel's native Neon integration, accessed through `@neondatabase/serverless` (every daily snapshot is stored — history retained). `@vercel/postgres` was deprecated when Vercel migrated all Postgres databases to Neon, so we use Neon's SDK directly.
- **Scheduling:** Vercel Cron, daily at 4:00am EST (09:00 UTC; will need DST-aware handling if EST/EDT shifts matter)
- **Auth:** Password-protected via env var (single shared password)
- **Styling:** Tailwind

### Planned file layout (not yet built)

```
app/
  layout.tsx            # root layout (scaffolded in Phase 6)
  page.tsx              # dashboard UI (two tables)
  globals.css           # Tailwind v4 entry
  api/
    refresh/route.ts    # cron-triggered NetSuite pull + calc + DB write
lib/
  db.ts                 # Neon serverless client + snapshot helpers (Phase 6)
  netsuite.ts           # TBA-signed RESTlet client (OAuth 1.0a)
  sku.ts                # parseSku() — blend code, type, size
  calc.ts               # pure calc: 3 reports → blend table + item table
migrations/
  0001_init_snapshots.sql       # snapshots(snapshot_date PK, payload JSONB)
scripts/
  migrate.ts                    # idempotent migration runner (Phase 6)
  test-restlet.mjs              # OAuth 1.0a smoke test (Phase 5)
netsuite/
  roasting_dashboard_restlet.js # SuiteScript 2.1
vercel.json             # cron config
```

## NetSuite integration

### Account

NetSuite account ID: **6617070**

- App / UI: `https://6617070.app.netsuite.com/`
- SuiteTalk REST (record store, SuiteQL): `https://6617070.suitetalk.api.netsuite.com/`
- **RESTlet endpoint** (different subdomain): `https://6617070.restlets.api.netsuite.com/app/site/hosting/restlet.nl?script={scriptId}&deploy={deploymentId}&savedSearchId={internalId}`
- Deployed RESTlet — **scriptId = 3855**, **deploymentId = 1**, status = Released. Custom script ID: `customscript3855`.

> NetSuite uses **separate subdomains** for SuiteTalk REST web services vs RESTlets. SuiteTalk lives at `suitetalk.api.netsuite.com` and expects paths like `/services/rest/record/v1/...` or `/services/rest/query/v1/suiteql`. RESTlets live at `restlets.api.netsuite.com/app/site/hosting/restlet.nl`. Calling a RESTlet on the SuiteTalk subdomain returns `INVALID_URL` (HTTP 400). When signing the OAuth 1.0a base string, the host + path here must exactly match the URL being hit.

> **Always send `Accept: application/json` and `Content-Type: application/json` headers.** Without an Accept header, NetSuite responds in a plain-text envelope (`error code: UNEXPECTED_ERROR / error message: An unexpected SuiteScript error has occurred`) that hides the real underlying error. With Accept: application/json, NetSuite returns structured JSON for both successes and errors, including the script's actual return value or a detailed error object. Cost us several debugging hours during initial integration.

### Auth: Token-Based Auth (OAuth 1.0a)

The app authenticates to NetSuite using TBA — four secret values stored as Vercel env vars:

- `NETSUITE_CONSUMER_KEY`
- `NETSUITE_CONSUMER_SECRET`
- `NETSUITE_TOKEN_ID`
- `NETSUITE_TOKEN_SECRET`

Plus:
- `NETSUITE_ACCOUNT_ID=6617070`
- `NETSUITE_SCRIPT_ID=3855`
- `NETSUITE_DEPLOY_ID=1`

### RESTlet: one script, three reports

A single SuiteScript 2.1 RESTlet (`netsuite/roasting_dashboard_restlet.js`) accepts a `savedSearchId` query param, runs `search.load()`, paginates with `runPaged({ pageSize: 1000 })`, and returns JSON of the form `{ savedSearchId, rowCount, rows: [...] }`. Each row is keyed by the saved search's column **labels** (the human-readable display names), falling back to internal field names when a label isn't set. For each cell, the RESTlet returns the displayed text when available, otherwise the raw value — so a numeric column returns a number, a name/select column returns its display string.

The same script handles all three saved searches; we just call it three times with different `savedSearchId` values.

### Saved searches in NetSuite

| Purpose | Name | Internal ID | Notes |
|---|---|---|---|
| Demand signal (per blend, lbs) | `GC - How Much Coffee to Roast?` | **3062** | Key column: `COFFEE TO ROAST OR PACK IN LBS` (no "Sum of" prefix) |
| Per-item bagging instructions | `GC - How Much Coffee to Package` | **3083** | Key column: `Units to Assemble` (no "Sum of" prefix) |
| Bulk inventory on hand | `GC - Coffee Inventory` | **3084** | Replaces the Saved Report (id 323) which can't be loaded via `search.load()`. Single-warehouse, so no location filter. Subsidiary filter (`Grace Coffee Roasters LLC`) mirrors the original report; relevant because the NetSuite account is OneWorld. |

### Saved-search column schemas (verified via Phase 5 smoke test)

> ⚠️ **NetSuite quirk:** for formula columns, SuiteScript's `column.label` returns the field-type label (e.g. "Formula (Numeric)") rather than the user-set Custom Label. The RESTlet returns each column's `formula` text and `summary` type; the calc identifies columns by a combination of **position + formula fingerprint** rather than label. If column order in the saved search ever changes, the calc must be updated to match (and a fingerprint check should fail-loud rather than silently mismap).

**3062 — Roast** (5 columns):

| Idx | Type | Custom Label (UI) | Formula fingerprint | Used as |
|---|---|---|---|---|
| 0 | text/group | (none) | `REGEXP_SUBSTR({item}, '^[^:]+')` | Blend name (trailing space — `.trim()`) |
| 1 | numeric/sum | Total Coffee Needed in lbs | `{quantity} * .75/.125/5` by `{unit}` | Needed lbs (passthrough col) |
| 2 | numeric/sum | Coffee Committed in lbs | `SUM(... {quantitycommitted} ...)` | Committed lbs (passthrough col) |
| 3 | numeric/sum | Coffee Roasting in lbs | contains `'Roasting'` | Roasting lbs (passthrough col) |
| 4 | numeric/sum | Coffee to Roast or Pack in lbs | `GREATEST(SUM(...) - SUM(...) - SUM(...), 0)` | **The demand signal — feeds `needed_lbs` in calc** |

**3083 — Package** (7 columns):

| Idx | Source | Role |
|---|---|---|
| 0 | `item` | Item display name, e.g. "Daily Grace : GCDG01-W12" |
| 1 | `unit` | Pack size string ("12 oz Bag" → 12oz, "2 oz Bag" → 2oz, "5 lb Bag" → 80oz) — drives lbs-per-unit conversion |
| 2 | `quantityuom`/sum | Sum of units sold (passthrough) |
| 3 | formula/sum | Sum of units committed (passthrough) |
| 4 | formula/sum | Sum of units not roasted (passthrough) |
| 5 | formula/sum | Sum of units in roasting (passthrough) |
| 6 | formula/sum | **Sum of units to assemble — feeds bag-lbs calc** |

**3084 — Inventory** (6 columns; we use 2, 3 or 5):

| Idx | Source | Role |
|---|---|---|
| 0 | `type` | "Inventory Item" / "Assembly" |
| 1 | `externalid` | Blend code (e.g., `GCDG01`) for bulk items |
| 2 | `displayname` | Match key — filter to `endsWith(" Bulk")`, then strip suffix to get blend name |
| 3 | `quantityavailable` (binOnHand join) | Available qty per bin |
| 4 | `internalid` | NetSuite internal ID |
| 5 | formula/sum | **On-hand minus excluded bins (Outbound Staging, Returns) — preferred over col 3** |

### Refresh flow

1. Vercel Cron fires `/api/refresh` daily at 4am EST.
2. Refresh handler calls the RESTlet three times (one per saved search), each with TBA-signed OAuth 1.0a headers.
3. The three JSON payloads are passed into the calc (`lib/calc.ts`).
4. The result (two tables) is written to Postgres with a date stamp.
5. The dashboard page reads the latest snapshot from Postgres on load — never hits NetSuite live.

## Calc logic

The only business logic the app computes is **how much to roast** and **how much to bag** per blend. Everything else is passed through from the saved searches.

### Per-blend (Table 1) — output columns

`Blend | How much to roast | How much to bag | Sum of Coffee Needed in lbs | Sum of Coffee Committed in lbs | Sum of Coffee Roasting in lbs | Sum of coffee to roast or pack in lbs`

The RESTlet returns each saved search as `{ columns: [...], rows: [[...], [...]] }` with rows aligned positionally to the columns array. Calc inputs are accessed by **column index**, validated against a per-column **formula fingerprint** so a column reorder fails loud rather than silently mismaps.

For each blend row in `GC - How Much Coffee to Roast?` (3062):

```
blend_name       = row[0].trim()                       # trailing whitespace from REGEXP_SUBSTR
needed_lbs       = parseFloat(row[4])                  # "Coffee to Roast or Pack in lbs"
on_hand_bulk_lbs = lookup_inventory_bulk(blend_name)   # see below
how_much_to_roast = max(0, needed_lbs - on_hand_bulk_lbs)
how_much_to_bag  = sum_over_package_rows_for_blend(blend_name)
```

**Inventory bulk lookup** — over `GC - Coffee Inventory` (3084) rows, find the row where `row[2]` (display name) equals `"{blend_name} Bulk"`; on-hand qty is `parseFloat(row[5])` (formula column that excludes Outbound Staging / Returns bins). If no match, treat as 0 lbs and surface `"no bulk inventory record found for {blend}"` in the UI — never crash.

**Bag total** — sum over all rows in `GC - How Much Coffee to Package` (3083) where `row[0]` (item name like `"Daily Grace : GCDG01-W12"`) starts with `"{blend_name} :"`:

```
units    = parseFloat(row[6])                # "Sum of Units to Assemble"
size_oz  = unit_to_oz(row[1])                # "12 oz Bag" → 12, "2 oz Bag" → 2, "5 lb Bag" → 80
lbs      = units * size_oz / 16
```

The pack size comes from the **Package report's `unit` column directly**, not from parsing the SKU — this avoids the SKU-convention inconsistency between the package and inventory reports (see [sku_pattern](../../home/codespace/.claude/projects/-workspaces-Daily-Roasting-Dashboard/memory/sku_pattern.md) memory). The unit column has values like `"12 oz Bag"`, `"2 oz Bag"`, `"5 lb Bag"`; map directly to `size_oz` by lookup.

The other lbs columns in Table 1 (`Sum of Coffee Committed`, `Sum of Coffee Roasting`, `Sum of coffee to roast or pack`) are passthroughs from the same roast-search row at indices 2, 3, 4.

### Per-item (Table 2) — output columns

`Item | Units | Sum of units sold | Sum of units committed | Sum of units not roasted | Sum of units in roasting | Sum of units to assemble`

Verbatim passthrough of `GC - How Much Coffee to Package`. No calc — render rows in order, pulling columns by index 0–6.

### Verified baseline (Phase 5 fixtures, 2026-05-09 00:10 UTC)

Real saved-search responses from Phase 5 are stored at [`fixtures/`](../fixtures/) and the expected calc output is at [`fixtures/expected_calc_output.json`](../fixtures/expected_calc_output.json). Calc unit tests should load the three response fixtures, run the calc, and assert it matches the expected output exactly:

| Blend | To roast (lbs) | To bag (lbs) |
|---|---|---|
| Daily Grace | 0 | 3 |
| Remmi Blend | 3 | 3 |

## SKU naming convention

Format: `{BLEND_CODE}-{TYPE}{SIZE}`

- **BLEND_CODE** — six-character blend identifier. Bare blend code (no suffix) is the bulk inventory item, displayed as `"{Blend Name} Bulk"`.
- **TYPE** — `G` = ground, `W` = whole bean.
- **SIZE** — number of ounces. Special value `80` = 5lb bag (80 oz).

### Known blend codes

| Code | Blend |
|---|---|
| `GCDG01` | Daily Grace |
| `GCCS01` | Colombian Supremo |
| `GCEB01` | Espresso Blend |
| `GCES01` | Ethiopian Sidamo |
| `GCGH01` | Guatemala |

### Examples

| SKU | Blend | Type | Size |
|---|---|---|---|
| `GCDG01` | Daily Grace | bulk | n/a (bulk) |
| `GCDG01-G12` | Daily Grace | ground | 12 oz |
| `GCDG01-W2` | Daily Grace | whole bean | 2 oz |
| `GCDG01-G80` | Daily Grace | ground | 80 oz (= 5 lb) |
| `GCDG08-Gx3` | (off-pattern — sample/multipack) | unknown | unknown |

### Parser behavior

`parseSku(sku)` returns `{ blendCode, type: 'ground'|'whole', sizeOz }` for standard SKUs and `null` for off-pattern SKUs (e.g., `GCDG08-Gx3`). Off-pattern items appear in Table 2 as-is but are excluded from the bag-lbs aggregation in Table 1; the UI surfaces a warning when this happens.

## Auth

Single shared password, stored in Vercel as `DASHBOARD_PASSWORD`. Middleware-based gate on every route. Plain enough that a small team can share access; can swap for Google SSO later if needs change.
