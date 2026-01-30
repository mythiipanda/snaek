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
  const wikiUrl = item.source_image_url;
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

/** Compare item we would write with existing row; true if no meaningful difference. */
function itemEquals(item, existing) {
  if (!existing) return false;
  const n = (v) => (v == null ? null : Number(v));
  const s = (v) => (v == null ? "" : String(v).trim());
  return (
    n(item.base_value) === n(existing.base_value) &&
    s(item.dg_value) === s(existing.dg_value) &&
    s(item.ck_value) === s(existing.ck_value) &&
    s(item.upg_value) === s(existing.upg_value) &&
    s(item.status) === s(existing.status) &&
    s(item.image_url) === s(existing.image_url) &&
    s(item.source_image_url) === s(existing.source_image_url)
  );
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
        const sourceImageUrl = it.image_url ?? null;
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
          image_url: sourceImageUrl, // Will be updated to storage URL after download
          source_image_url: sourceImageUrl, // Store original wiki URL
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

  const { data: existingRows } = await supabase.from("items").select("id, base_value, dg_value, ck_value, upg_value, status, image_url, source_image_url");
  const existingById = {};
  for (const row of existingRows ?? []) {
    existingById[row.id] = row;
  }

  if (!SKIP_IMAGE_UPLOAD) {
    await ensureBucket();
    // Only download/upload images if source_image_url has changed or doesn't exist
    const withImages = items.filter((i) => {
      if (!i.source_image_url || isOurStorageUrl(i.source_image_url)) return false;
      const existing = existingById[i.id];
      // Download if no existing record or source_image_url has changed
      return !existing || (existing.source_image_url || "") !== (i.source_image_url || "");
    });
    console.log("Downloading/uploading", withImages.length, "images (only items with changed source URLs)...");
    for (let i = 0; i < withImages.length; i++) {
      const idx = items.indexOf(withImages[i]);
      items[idx] = await downloadAndUploadImage(items[idx]);
      process.stdout.write("\r  " + (i + 1) + " / " + withImages.length);
    }
    console.log("");
    
    // For items that didn't need downloading, preserve their existing image_url if source hasn't changed
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const existing = existingById[item.id];
      if (existing && existing.image_url && (existing.source_image_url || "") === (item.source_image_url || "")) {
        // Source hasn't changed, preserve existing storage URL
        items[i] = { ...item, image_url: existing.image_url };
      }
    }
  } else {
    console.log("Skipping image upload (SKIP_IMAGE_UPLOAD is set).");
  }

  const toUpsert = items.filter((item) => !itemEquals(item, existingById[item.id]));
  if (toUpsert.length < items.length) {
    console.log("Skipping", items.length - toUpsert.length, "items unchanged from existing.");
  }
  console.log("Upserting", toUpsert.length, "items...");
  const BATCH = 500;
  for (let i = 0; i < toUpsert.length; i += BATCH) {
    const chunk = toUpsert.slice(i, i + BATCH);
    const { error } = await supabase.from("items").upsert(chunk, { onConflict: "id" });
    if (error) {
      console.error("Items upsert failed at batch", i / BATCH, error.message);
      process.exit(1);
    }
    process.stdout.write("\r" + Math.min(i + BATCH, toUpsert.length) + " / " + toUpsert.length);
  }
  console.log("\nDone.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
