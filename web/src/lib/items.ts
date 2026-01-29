import "server-only";

import { createSupabaseClient } from "@/lib/supabase";
import type { Item, RawItem } from "@/lib/items-types";
export type { Item, RawItem, ValueField } from "@/lib/items-types";

/**
 * Load all items from Supabase, ordered by group, gun, base_value desc, skin_name.
 * Falls back to local JSON if Supabase env is not set (e.g. local dev without DB).
 */
export async function loadItems(): Promise<Item[]> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (supabaseUrl && supabaseAnonKey) {
    const supabase = createSupabaseClient();
    const { data: rows, error } = await supabase
      .from("items")
      .select("id, group_name, gun, skin_name, base_value, dg_value, ck_value, upg_value, status, image_url")
      .order("group_name")
      .order("gun")
      .order("base_value", { ascending: false, nullsFirst: false })
      .order("skin_name");

    if (!error && rows && rows.length > 0) {
      const items: Item[] = rows.map((row) => ({
        id: row.id,
        gun: row.gun,
        skin_name: row.skin_name,
        base_value: row.base_value != null ? Number(row.base_value) : null,
        dg_value: row.dg_value ?? null,
        ck_value: row.ck_value ?? null,
        upg_value: row.upg_value ?? null,
        status: row.status ?? null,
        image_url: row.image_url ?? null,
      }));
      return items;
    }
    if (error) {
      console.warn("Supabase loadItems error, falling back to JSON:", error.message);
    }
  }

  return loadItemsFromJson();
}

/**
 * Fallback: load items from local JSON (for dev without Supabase or when DB is empty).
 */
async function loadItemsFromJson(): Promise<Item[]> {
  const { readFile } = await import("node:fs/promises");
  const path = await import("node:path");
  type ItemsDb = {
    metadata?: unknown;
    guns?: Record<string, RawItem[]>;
    knives?: Record<string, RawItem[]>;
    gloves?: Record<string, RawItem[]>;
  };
  const dbPath = path.resolve(process.cwd(), "..", "data", "items_with_images.json");
  let raw: string;
  try {
    raw = await readFile(dbPath, "utf8");
  } catch {
    return [];
  }
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
