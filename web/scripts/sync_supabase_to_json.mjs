/**
 * Sync values from Supabase into data/items_with_images.json.
 * Keeps the existing file structure and skin order; only updates
 * base_value, dg_value, ck_value, upg_value, status, image_url (and metadata).
 *
 * Run from repo root: node web/scripts/sync_supabase_to_json.mjs
 * Or from web/: node scripts/sync_supabase_to_json.mjs
 * Requires .env in web/ with SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or anon key for read).
 */

import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webDir = __dirname.includes("/web/") ? path.join(__dirname, "..") : path.join(__dirname, "..", "web");
dotenv.config({ path: path.join(webDir, ".env") });

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error(
    "Missing SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY in web/.env"
  );
  process.exit(1);
}

const dataPath = path.resolve(webDir, "..", "data", "items_with_images.json");
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function itemId(groupName, gun, skinName) {
  return `${groupName}:${gun}:${String(skinName ?? "").trim()}`.toLowerCase();
}

function toValue(v) {
  if (v == null || v === "") return null;
  const s = String(v).trim();
  const n = Number(s);
  if (Number.isFinite(n) && String(n) === s) return n;
  return v;
}

async function main() {
  console.log("Reading", dataPath);
  const raw = await readFile(dataPath, "utf8");
  const file = JSON.parse(raw);

  console.log("Fetching metadata...");
  const { data: metaRows, error: metaErr } = await supabase
    .from("metadata")
    .select("version, last_updated, source, discord, notes")
    .order("created_at", { ascending: false })
    .limit(1);
  if (metaErr) {
    console.error("Metadata fetch failed:", metaErr.message);
    process.exit(1);
  }
  const meta = metaRows?.[0] ?? null;
  if (meta) {
    file.metadata = {
      ...file.metadata,
      version: meta.version ?? file.metadata?.version,
      last_updated: meta.last_updated ?? file.metadata?.last_updated,
      source: meta.source ?? file.metadata?.source,
      discord: meta.discord ?? file.metadata?.discord,
      notes: meta.notes ?? file.metadata?.notes,
    };
  }

  console.log("Fetching items...");
  const { data: items, error: itemsErr } = await supabase
    .from("items")
    .select("id, base_value, dg_value, ck_value, upg_value, status, image_url, source_image_url");
  if (itemsErr) {
    console.error("Items fetch failed:", itemsErr.message);
    process.exit(1);
  }
  const byId = {};
  for (const row of items ?? []) {
    byId[row.id] = row;
  }

  let updated = 0;
  const groupNames = ["guns", "knives", "gloves"];
  for (const groupName of groupNames) {
    const group = file[groupName];
    if (!group || typeof group !== "object") continue;
    for (const [gun, list] of Object.entries(group)) {
      if (!Array.isArray(list)) continue;
      for (const entry of list) {
        const skin = String(entry.skin_name ?? "").trim();
        if (!skin) continue;
        const id = itemId(groupName, gun, skin);
        const row = byId[id];
        if (!row) continue;
        entry.base_value =
          row.base_value != null && Number.isFinite(Number(row.base_value))
            ? Number(row.base_value)
            : null;
        entry.dg_value = toValue(row.dg_value);
        entry.ck_value = toValue(row.ck_value);
        entry.upg_value = toValue(row.upg_value);
        entry.status = row.status ?? null;
        entry.image_url = row.source_image_url ?? row.image_url ?? null;
        updated++;
      }
    }
  }

  await writeFile(dataPath, JSON.stringify(file, null, 2), "utf8");
  console.log("Updated", updated, "item values in", dataPath);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
