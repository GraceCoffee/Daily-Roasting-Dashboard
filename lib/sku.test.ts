import { describe, expect, it } from "vitest";
import { extractSkuFromItemName, parseSku } from "./sku";

describe("parseSku", () => {
  it("parses whole-bean SKUs", () => {
    expect(parseSku("GCDG01-W12")).toEqual({
      blendCode: "GCDG01",
      type: "whole",
      sizeOz: 12,
    });
    expect(parseSku("GCDG01-W2")).toEqual({
      blendCode: "GCDG01",
      type: "whole",
      sizeOz: 2,
    });
  });

  it("parses ground SKUs", () => {
    expect(parseSku("GCDG01-G12")).toEqual({
      blendCode: "GCDG01",
      type: "ground",
      sizeOz: 12,
    });
  });

  it("parses the 5lb-bag SKU as 80 oz", () => {
    expect(parseSku("GCDG01-G80")).toEqual({
      blendCode: "GCDG01",
      type: "ground",
      sizeOz: 80,
    });
  });

  it("returns null for off-pattern SKUs", () => {
    expect(parseSku("GCDG08-Gx3")).toBeNull();
    expect(parseSku("GCDG01-GA")).toBeNull();
    expect(parseSku("GCDG01-Z12")).toBeNull();
  });

  it("returns null for bulk (bare blend code, no suffix)", () => {
    expect(parseSku("GCDG01")).toBeNull();
  });

  it("returns null for empty / garbage input", () => {
    expect(parseSku("")).toBeNull();
    expect(parseSku("not a sku")).toBeNull();
  });
});

describe("extractSkuFromItemName", () => {
  it("returns the SKU portion after the colon separator", () => {
    expect(extractSkuFromItemName("Daily Grace : GCDG01-W12")).toBe(
      "GCDG01-W12",
    );
  });

  it("returns null for names with no separator", () => {
    expect(extractSkuFromItemName("Daily Grace Bulk")).toBeNull();
  });
});
