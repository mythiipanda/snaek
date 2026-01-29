import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";

import type { Item, RawItem } from "@/lib/items-types";
export type { Item, RawItem, ValueField } from "@/lib/items-types";

type ItemsDb = {
  metadata?: unknown;
  guns?: Record<string, RawItem[]>;
  knives?: Record<string, RawItem[]>;
  gloves?: Record<string, RawItem[]>;
};

function getDbPath() {
  // Next.js runs from the Next project root (valuelist/web).
  // The JSON database lives at valuelist/data/items_with_images.json.
  return path.resolve(process.cwd(), "..", "data", "items_with_images.json");
}

export async function loadItems(): Promise<Item[]> {
  const dbPath = getDbPath();
  const raw = await readFile(dbPath, "utf8");
  const parsed = JSON.parse(raw) as ItemsDb;

  const groups: Array<[string, Record<string, RawItem[]>]> = [
    ["guns", parsed?.guns ?? {}],
    ["knives", parsed?.knives ?? {}],
    ["gloves", parsed?.gloves ?? {}],
  ];
  const items: Item[] = [];

  for (const [groupName, group] of groups) {
    for (const [typeKey, groupItems] of Object.entries(group)) {
      for (const it of groupItems ?? []) {
        const skin_name = String(it.skin_name ?? "").trim();
        if (!skin_name) continue;

        items.push({
          id: `${groupName}:${typeKey}:${skin_name}`.toLowerCase(),
          gun: typeKey,
          skin_name,
          base_value: it.base_value ?? null,
          dg_value: it.dg_value ?? null,
          ck_value: it.ck_value ?? null,
          upg_value: it.upg_value ?? null,
          status: it.status ?? null,
          image_url: it.image_url ?? null,
        });
      }
    }
  }

  // Stable-ish ordering: gun then value desc then name.
  items.sort((a, b) => {
    const gunCmp = a.gun.localeCompare(b.gun);
    if (gunCmp !== 0) return gunCmp;
    const av = typeof a.base_value === "number" ? a.base_value : -1;
    const bv = typeof b.base_value === "number" ? b.base_value : -1;
    if (av !== bv) return bv - av;
    return a.skin_name.localeCompare(b.skin_name);
  });

  return items;
}

