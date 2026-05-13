import { describe, expect, it } from "vitest";
import roastFixture from "../fixtures/roast_search_3062.json";
import packageFixture from "../fixtures/package_search_3083.json";
import inventoryFixture from "../fixtures/inventory_search_3084.json";
import expectedOutput from "../fixtures/expected_calc_output.json";
import { calculateSnapshot, type RestletResponse } from "./calc";

function stripMeta<T extends Record<string, unknown>>(obj: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (!k.startsWith("_")) out[k] = v;
  }
  return out as T;
}

describe("calculateSnapshot", () => {
  it("reproduces the Phase 5 verified baseline", () => {
    const result = calculateSnapshot(
      roastFixture as unknown as RestletResponse,
      packageFixture as unknown as RestletResponse,
      inventoryFixture as unknown as RestletResponse,
    );
    expect(result).toEqual(stripMeta(expectedOutput));
  });

  it("throws on roast-search schema drift (column count)", () => {
    const broken = {
      ...roastFixture,
      columns: roastFixture.columns.slice(0, 4),
    } as unknown as RestletResponse;
    expect(() =>
      calculateSnapshot(
        broken,
        packageFixture as unknown as RestletResponse,
        inventoryFixture as unknown as RestletResponse,
      ),
    ).toThrow(/expected 5 columns/);
  });

  it("throws on roast-search formula-fingerprint drift", () => {
    const broken = JSON.parse(JSON.stringify(roastFixture)) as RestletResponse;
    broken.columns[4].formula = "SUM({quantity})";
    expect(() =>
      calculateSnapshot(
        broken,
        packageFixture as unknown as RestletResponse,
        inventoryFixture as unknown as RestletResponse,
      ),
    ).toThrow(/fingerprint mismatch/);
  });

  it("emits a warning when a blend has no matching bulk inventory row", () => {
    const roast = JSON.parse(JSON.stringify(roastFixture)) as RestletResponse;
    roast.rows[0][0] = "Mystery Blend ";
    const pack = JSON.parse(JSON.stringify(packageFixture)) as RestletResponse;
    pack.rows = [];
    const result = calculateSnapshot(
      roast,
      pack,
      inventoryFixture as unknown as RestletResponse,
    );
    expect(result.warnings).toContain(
      "no bulk inventory record found for Mystery Blend",
    );
  });

  it("excludes off-pattern SKUs from the bag total and warns", () => {
    const pack = JSON.parse(JSON.stringify(packageFixture)) as RestletResponse;
    pack.rows.push([
      "Daily Grace : GCDG08-Gx3",
      "12 oz Bag",
      "10",
      "0",
      "0",
      "0",
      "10",
    ]);
    const result = calculateSnapshot(
      roastFixture as unknown as RestletResponse,
      pack,
      inventoryFixture as unknown as RestletResponse,
    );
    const dailyGrace = result.blends.find((b) => b.blend === "Daily Grace")!;
    expect(dailyGrace.howMuchToBagLbs).toBe(3);
    expect(result.warnings.some((w) => w.includes("GCDG08-Gx3"))).toBe(true);
  });
});
