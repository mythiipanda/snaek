export type ValueField = "base_value" | "dg_value" | "ck_value" | "upg_value";

export type RawItem = {
  skin_name: string;
  base_value: number | null;
  dg_value: number | string | null;
  ck_value: number | null;
  upg_value: number | null;
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

  // Try range first: "1300-1400"
  const rangeMatch = str.match(/(\d[\d,]*)\s*-\s*(\d[\d,]*)/);
  if (rangeMatch) {
    const min = Number.parseInt(rangeMatch[1].replace(/,/g, ""), 10);
    const max = Number.parseInt(rangeMatch[2].replace(/,/g, ""), 10);
    const minOk = Number.isFinite(min) ? min : null;
    const maxOk = Number.isFinite(max) ? max : null;
    return { min: minOk, max: maxOk, hasPlus };
  }

  // Fallback to single number (possibly with "+")
  const match = str.match(/(\d[\d,]*)/);
  const num =
    match && match[1]
      ? Number.parseInt(match[1].replace(/,/g, ""), 10)
      : null;

  const n = Number.isFinite(num as number) ? (num as number) : null;
  return { min: n, max: n, hasPlus };
}

export function getValue(item: Item, field: ValueField): ParsedValue {
  const v = item[field];
  return parseField(v as number | string | null | undefined);
}

