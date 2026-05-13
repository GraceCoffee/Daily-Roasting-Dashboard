import type { BlendRow, ItemRow, SnapshotPayload } from "./db";
import { extractSkuFromItemName, parseSku } from "./sku";

export type RestletColumn = {
  index: number;
  name: string | null;
  label: string | null;
  formula: string | null;
  type: string | null;
  join: string | null;
  summary: string | null;
  sortDir: string | null;
};

export type RestletResponse = {
  savedSearchId: string;
  rowCount: number;
  columns: RestletColumn[];
  rows: string[][];
};

export type CalcOutput = Omit<SnapshotPayload, "generatedAt">;

const UNIT_TO_OZ: Record<string, number> = {
  "12 oz Bag": 12,
  "2 oz Bag": 2,
  "5 lb Bag": 80,
};

export function calculateSnapshot(
  roast: RestletResponse,
  pack: RestletResponse,
  inventory: RestletResponse,
): CalcOutput {
  validateRoastSchema(roast);
  validatePackageSchema(pack);
  validateInventorySchema(inventory);

  const warnings: string[] = [];
  const bulkOnHand = buildBulkOnHandIndex(inventory);
  const itemsByBlend = groupPackageRowsByBlend(pack, warnings);

  const blends: BlendRow[] = roast.rows.map((row) => {
    const blend = row[0].trim();
    const neededLbs = num(row[1]);
    const committedLbs = num(row[2]);
    const roastingLbs = num(row[3]);
    const toRoastOrPackLbs = num(row[4]);

    const bulkLbs = bulkOnHand.get(blend);
    if (bulkLbs === undefined) {
      warnings.push(`no bulk inventory record found for ${blend}`);
    }
    const howMuchToRoastLbs = Math.max(0, toRoastOrPackLbs - (bulkLbs ?? 0));
    const howMuchToBagLbs = computeBagLbs(itemsByBlend.get(blend) ?? []);

    return {
      blend,
      howMuchToRoastLbs,
      howMuchToBagLbs,
      neededLbs,
      committedLbs,
      roastingLbs,
      toRoastOrPackLbs,
    };
  });

  blends.sort((a, b) => a.blend.localeCompare(b.blend));

  const items: ItemRow[] = pack.rows.map((row) => ({
    item: row[0],
    unit: row[1],
    unitsSold: num(row[2]),
    unitsCommitted: num(row[3]),
    unitsNotRoasted: num(row[4]),
    unitsInRoasting: num(row[5]),
    unitsToAssemble: num(row[6]),
  }));

  return { blends, items, warnings };
}

function buildBulkOnHandIndex(
  inventory: RestletResponse,
): Map<string, number> {
  const index = new Map<string, number>();
  for (const row of inventory.rows) {
    const displayName = row[2];
    if (!displayName.endsWith(" Bulk")) continue;
    const blend = displayName.slice(0, -" Bulk".length);
    index.set(blend, num(row[5]));
  }
  return index;
}

function groupPackageRowsByBlend(
  pack: RestletResponse,
  warnings: string[],
): Map<string, string[][]> {
  const grouped = new Map<string, string[][]>();
  for (const row of pack.rows) {
    const itemName = row[0];
    const sep = itemName.indexOf(" : ");
    if (sep === -1) continue;
    const blend = itemName.slice(0, sep);
    const skuPart = extractSkuFromItemName(itemName);
    if (skuPart && parseSku(skuPart) === null) {
      warnings.push(
        `off-pattern SKU excluded from ${blend} bag total: ${itemName}`,
      );
      continue;
    }
    const list = grouped.get(blend) ?? [];
    list.push(row);
    grouped.set(blend, list);
  }
  return grouped;
}

function computeBagLbs(rows: string[][]): number {
  let totalLbs = 0;
  for (const row of rows) {
    const units = num(row[6]);
    const sizeOz = UNIT_TO_OZ[row[1]];
    if (sizeOz === undefined) {
      throw new Error(
        `Unknown package unit string: ${JSON.stringify(row[1])} (item: ${row[0]}). Add it to UNIT_TO_OZ.`,
      );
    }
    totalLbs += (units * sizeOz) / 16;
  }
  return totalLbs;
}

function num(cell: string): number {
  if (cell === "" || cell === null || cell === undefined) return 0;
  const n = Number.parseFloat(cell);
  if (!Number.isFinite(n)) return 0;
  return n;
}

function validateRoastSchema(r: RestletResponse): void {
  if (r.columns.length !== 5) {
    throw schemaErr(r, `expected 5 columns, got ${r.columns.length}`);
  }
  assertCol(r, 0, (c) => c.formula?.startsWith("REGEXP_SUBSTR({item}") === true, "blend name");
  assertCol(r, 1, (c) => c.formula?.includes("{quantity} * .75") === true, "needed lbs");
  assertCol(r, 2, (c) => c.formula?.startsWith("SUM(") === true && c.formula.includes("{quantitycommitted}"), "committed lbs");
  assertCol(r, 3, (c) => c.formula?.startsWith("CASE") === true && c.formula.includes("'Roasting'"), "roasting lbs");
  assertCol(r, 4, (c) => c.formula?.startsWith("GREATEST(") === true, "to roast or pack lbs");
}

function validatePackageSchema(r: RestletResponse): void {
  if (r.columns.length !== 7) {
    throw schemaErr(r, `expected 7 columns, got ${r.columns.length}`);
  }
  assertCol(r, 0, (c) => c.name === "item", "item");
  assertCol(r, 1, (c) => c.name === "unit", "unit");
  assertCol(r, 2, (c) => c.name === "quantityuom", "units sold");
  assertCol(r, 3, (c) => c.formula?.includes("IN ('12 oz Bag','2 oz Bag','5 lb Bag')") === true, "units committed");
  assertCol(r, 4, (c) => c.formula?.includes("'Not Roasted'") === true, "units not roasted");
  assertCol(r, 5, (c) => c.formula?.includes("'Roasting'") === true, "units in roasting");
  assertCol(r, 6, (c) => c.formula?.includes("SUM(NVL({quantity},0))") === true && c.formula.includes("SUM(NVL({quantitycommitted},0))"), "units to assemble");
}

function validateInventorySchema(r: RestletResponse): void {
  if (r.columns.length !== 6) {
    throw schemaErr(r, `expected 6 columns, got ${r.columns.length}`);
  }
  assertCol(r, 0, (c) => c.name === "type", "type");
  assertCol(r, 1, (c) => c.name === "externalid", "external id");
  assertCol(r, 2, (c) => c.name === "displayname", "display name");
  assertCol(r, 3, (c) => c.name === "quantityavailable" && c.join === "binOnHand", "qty available per bin");
  assertCol(r, 4, (c) => c.name === "internalid", "internal id");
  assertCol(r, 5, (c) => c.formula?.includes("Outbound Staging") === true, "on-hand excluding staging");
}

function assertCol(
  r: RestletResponse,
  idx: number,
  predicate: (col: RestletColumn) => boolean,
  desc: string,
): void {
  const col = r.columns[idx];
  if (!col) throw schemaErr(r, `missing column at index ${idx} (expected ${desc})`);
  if (!predicate(col)) {
    throw schemaErr(
      r,
      `column ${idx} fingerprint mismatch (expected ${desc}); got name=${col.name} formula=${col.formula?.slice(0, 80) ?? "null"}`,
    );
  }
}

function schemaErr(r: RestletResponse, msg: string): Error {
  return new Error(`Saved search ${r.savedSearchId}: ${msg}`);
}
