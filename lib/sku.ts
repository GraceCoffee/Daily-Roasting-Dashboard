export type ParsedSku = {
  blendCode: string;
  type: "ground" | "whole";
  sizeOz: number;
};

const STANDARD_PATTERN = /^([A-Z]{2,}\d{2,})-([GW])(\d+)$/;

export function parseSku(sku: string): ParsedSku | null {
  const match = STANDARD_PATTERN.exec(sku);
  if (!match) return null;
  const [, blendCode, typeChar, sizeStr] = match;
  const sizeOz = Number.parseInt(sizeStr, 10);
  if (!Number.isFinite(sizeOz) || sizeOz <= 0) return null;
  return {
    blendCode,
    type: typeChar === "G" ? "ground" : "whole",
    sizeOz,
  };
}

export function extractSkuFromItemName(itemName: string): string | null {
  const idx = itemName.indexOf(" : ");
  if (idx === -1) return null;
  return itemName.slice(idx + 3).trim();
}
