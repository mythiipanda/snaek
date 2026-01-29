export type ValueField = "base_value" | "dg_value" | "ck_value" | "upg_value";

export type RawItem = {
  skin_name: string;
  base_value: number | null;
  dg_value: number | string | null;
  ck_value: number | string | null;
  upg_value: number | string | null;
  status: string | null;
  image_url: string | null;
};

export type Item = RawItem & {
  id: string;
  gun: string;
};

export type ParsedValue = {
  min: number | null;
  max: number | null;
  hasPlus: boolean;
};

function parseNumberWithSuffix(raw: string, defaultMultiplier = 1): number | null {
  const lower = raw.toLowerCase();
  let multiplier = defaultMultiplier;
  if (lower.includes("m")) {
    multiplier = 1_000_000;
  } else if (lower.includes("k")) {
    multiplier = 1_000;
  }

  const cleaned = lower.replace(/[^0-9.,]/g, "");
  if (!cleaned) return null;

  const normalized = cleaned.replace(/,/g, "."); // handle both 1,2 and 1.2
  const num = Number.parseFloat(normalized);
  if (!Number.isFinite(num)) return null;

  return Math.round(num * multiplier);
}

export function parseField(raw: number | string | null | undefined): ParsedValue {
  if (raw === null || raw === undefined) {
    return { min: null, max: null, hasPlus: false };
  }

  if (typeof raw === "number") {
    const n = Number.isFinite(raw) ? raw : null;
    return { min: n, max: n, hasPlus: false };
  }

  const str = String(raw).trim();
  const lower = str.toLowerCase();
  const hasPlus = lower.includes("+");

  // Ranges like "1300-1400", "38-40k", "1.2k-1.4k"
  const parts = lower.split("-");
  if (parts.length === 2) {
    const [left, right] = parts;
    // If only right has suffix, reuse it for left.
    const rightHasSuffix = /[km]/.test(right);
    const baseMultiplier = rightHasSuffix
      ? right.includes("m")
        ? 1_000_000
        : 1_000
      : 1;

    const min = parseNumberWithSuffix(left, baseMultiplier);
    const max = parseNumberWithSuffix(right, baseMultiplier);

    return {
      min: Number.isFinite(min as number) ? (min as number) : null,
      max: Number.isFinite(max as number) ? (max as number) : null,
      hasPlus,
    };
  }

  // Single number with optional suffix, e.g. "23.5k", "1.2m", "700"
  const n = parseNumberWithSuffix(lower);
  return {
    min: Number.isFinite(n as number) ? (n as number) : null,
    max: Number.isFinite(n as number) ? (n as number) : null,
    hasPlus,
  };
}

export function getValue(item: Item, field: ValueField): ParsedValue {
  const v = item[field];
  return parseField(v as number | string | null | undefined);
}

