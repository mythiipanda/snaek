/**
 * Seed Supabase with items and metadata from data/items_with_images.json.
 * Downloads item images from wiki URLs and uploads them to Supabase Storage,
 * then updates item.image_url to the storage public URL.
 *
 * Run from repo root: node web/scripts/seed_supabase.mjs
 * Or from web/: node scripts/seed_supabase.mjs
 * Requires .env in web/ with SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
 *
 * Set SKIP_IMAGE_UPLOAD=1 to only seed DB without downloading/uploading images.
 */

import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const webDir = __dirname.includes("/web/") ? path.join(__dirname, "..") : path.join(__dirname, "..", "web");
dotenv.config({ path: path.join(webDir, ".env") });

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SKIP_IMAGE_UPLOAD = process.env.SKIP_IMAGE_UPLOAD === "1" || process.env.SKIP_IMAGE_UPLOAD === "true";

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY in web/.env");
  process.exit(1);
}

const dataPath = path.resolve(webDir, "..", "data", "items_with_images.json");
const STORAGE_BUCKET = "item-images";
const WIKI_DELAY_MS = 200;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function isOurStorageUrl(url) {
  if (!url || typeof url !== "string") return false;
  try {
    const u = new URL(url);
    return u.origin === new URL(SUPABASE_URL).origin && u.pathname.includes("/storage/");
  } catch {
    return false;
  }
}

function getExtensionFromUrl(url) {
  const match = url.match(/\.(png|jpg|jpeg|gif|webp)(?:\?|$)/i);
  return match ? match[1].toLowerCase() : "png";
}

/** Sanitize storage path: Supabase rejects [ ] in keys. Use bot_s_ for bot[s]. */
function storagePathSafe(id) {
  return id.replace(/\[/g, "_").replace(/\]/g, "_").replace(/:/g, "/");
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function ensureBucket() {
  const { data: buckets } = await supabase.storage.listBuckets();
  if (buckets?.some((b) => b.name === STORAGE_BUCKET)) return;
  const { error } = await supabase.storage.createBucket(STORAGE_BUCKET, { public: true });
  if (error) {
    if (error.message?.includes("already exists") || error.message?.includes("duplicate")) return;
    throw new Error("Failed to create storage bucket: " + error.message);
  }
  console.log("Created storage bucket:", STORAGE_BUCKET);
}

async function downloadAndUploadImage(item) {
  const wikiUrl = item.image_url;
  if (!wikiUrl || isOurStorageUrl(wikiUrl)) return item;

  try {
    const res = await fetch(wikiUrl, {
      headers: { "User-Agent": "SnaekSeeder/1.0 (https://github.com/snaek)" },
      redirect: "follow",
    });
    if (!res.ok) return item;
    const contentType = res.headers.get("content-type") || "";
    const ext = getExtensionFromUrl(wikiUrl);
    const buffer = Buffer.from(await res.arrayBuffer());
    const storagePath = `items/${storagePathSafe(item.id)}.${ext}`;

    const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(storagePath, buffer, {
      contentType: contentType.startsWith("image/") ? contentType : `image/${ext}`,
      upsert: true,
    });
    if (error) {
      console.warn("Upload failed for", item.id, error.message);
      return item;
    }
    const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(storagePath);
    return { ...item, image_url: data.publicUrl };
  } catch (err) {
    console.warn("Fetch/upload failed for", item.id, err.message);
    return item;
  }
}

function flattenItems(parsed) {
  const groups = [
    ["guns", parsed?.guns ?? {}],
    ["knives", parsed?.knives ?? {}],
    ["gloves", parsed?.gloves ?? {}],
  ];
  const items = [];
  for (const [groupName, group] of groups) {
    for (const [typeKey, groupItems] of Object.entries(group)) {
      for (const it of groupItems ?? []) {
        const skin_name = String(it.skin_name ?? "").trim();
        if (!skin_name) continue;
        items.push({
          id: `${groupName}:${typeKey}:${skin_name}`.toLowerCase(),
          group_name: groupName,
          gun: typeKey,
          skin_name,
          base_value: it.base_value != null && typeof it.base_value === "number" ? it.base_value : null,
          dg_value: it.dg_value != null ? String(it.dg_value) : null,
          ck_value: it.ck_value != null ? String(it.ck_value) : null,
          upg_value: it.upg_value != null ? String(it.upg_value) : null,
          status: it.status ?? null,
          image_url: it.image_url ?? null,
        });
      }
    }
  }
  return items;
}

async function main() {
  console.log("Reading", dataPath);
  const raw = await readFile(dataPath, "utf8");
  const parsed = JSON.parse(raw);

  const meta = parsed.metadata ?? {};
  const lastUpdated = meta.last_updated ? new Date(meta.last_updated).toISOString().slice(0, 10) : null;

  console.log("Inserting metadata...");
  const { error: insErr } = await supabase.from("metadata").insert({
    version: meta.version ?? null,
    last_updated: lastUpdated,
    source: meta.source ?? null,
    discord: meta.discord ?? null,
    notes: meta.notes ?? null,
  });
  if (insErr) {
    console.error("Metadata insert failed:", insErr.message);
    process.exit(1);
  }

  let items = flattenItems(parsed);

  if (!SKIP_IMAGE_UPLOAD) {
    await ensureBucket();
    const { data: existingRows } = await supabase.from("items").select("id, image_url");
    const existingStorageUrls = {};
    for (const row of existingRows ?? []) {
      if (row?.image_url && isOurStorageUrl(row.image_url)) existingStorageUrls[row.id] = row.image_url;
    }
    const withImages = items.filter((i) => i.image_url && !isOurStorageUrl(i.image_url));
    const toFetch = withImages.filter((i) => !existingStorageUrls[i.id]);
    const skipped = withImages.length - toFetch.length;
    if (skipped) console.log("Skipping", skipped, "images already in Storage.");
    console.log("Downloading/uploading", toFetch.length, "images to Supabase Storage...");
    for (let i = 0; i < toFetch.length; i++) {
      const idx = items.indexOf(toFetch[i]);
      items[idx] = await downloadAndUploadImage(items[idx]);
      if (i < toFetch.length - 1) await sleep(WIKI_DELAY_MS);
      process.stdout.write("\r  " + (i + 1) + " / " + toFetch.length);
    }
    for (const it of withImages) {
      if (existingStorageUrls[it.id]) items[items.indexOf(it)].image_url = existingStorageUrls[it.id];
    }
    if (toFetch.length || skipped) console.log("");
  } else {
    console.log("Skipping image upload (SKIP_IMAGE_UPLOAD is set).");
  }

  console.log("Upserting", items.length, "items...");
  const BATCH = 500;
  for (let i = 0; i < items.length; i += BATCH) {
    const chunk = items.slice(i, i + BATCH);
    const { error } = await supabase.from("items").upsert(chunk, { onConflict: "id" });
    if (error) {
      console.error("Items upsert failed at batch", i / BATCH, error.message);
      process.exit(1);
    }
    process.stdout.write("\r" + Math.min(i + BATCH, items.length) + " / " + items.length);
  }
  console.log("\nDone.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
