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

/** Parse a single numeric string (DB values are already normalized: plain numbers or "min-max"). */
function parseNum(s: string): number | null {
  const n = Number.parseFloat(s.trim());
  return Number.isFinite(n) ? n : null;
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
  const hasPlus = str.includes("+");

  // Range "min-max" (DB already normalized to plain integers)
  const parts = str.split("-");
  if (parts.length === 2) {
    const min = parseNum(parts[0].trim());
    const max = parseNum(parts[1].trim());
    if (min != null && max != null) {
      return { min, max, hasPlus };
    }
  }

  // Single number (optional trailing +)
  const single = parseNum(str.replace(/\+$/, "").trim());
  if (single != null) {
    return { min: single, max: single, hasPlus };
  }

  return { min: null, max: null, hasPlus: false };
}

export function getValue(item: Item, field: ValueField): ParsedValue {
  const v = item[field];
  return parseField(v as number | string | null | undefined);
}

/** Format a number with K/M suffix for display (e.g. 1100 → "1.1k", 1500000 → "1.5M"). */
export function formatValueCompact(n: number): string {
  if (!Number.isFinite(n)) return "—";
  const abs = Math.abs(n);
  if (abs >= 1_000_000) {
    const v = n / 1_000_000;
    const s = v % 1 === 0 ? String(Math.round(v)) : v.toFixed(1);
    return `${s}M`;
  }
  if (abs >= 1_000) {
    const v = n / 1_000;
    const s = v % 1 === 0 ? String(Math.round(v)) : v.toFixed(1);
    return `${s}k`;
  }
  return n.toLocaleString();
}

/** Format a parsed value (single or range) with K/M, preserving range and optional +. */
export function formatParsedValueCompact(pv: ParsedValue): string {
  if (pv.min == null && pv.max == null) return "—";
  const min = pv.min ?? pv.max ?? 0;
  const max = pv.max ?? pv.min ?? 0;
  const core =
    min === max
      ? formatValueCompact(min)
      : `${formatValueCompact(min)}–${formatValueCompact(max)}`;
  return `${core}${pv.hasPlus ? "+" : ""}`;
}

