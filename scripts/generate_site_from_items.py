#!/usr/bin/env python3
"""Generate a simple static HTML site from the new JSON format with "guns" structure.

Saves output to `valuelist/mock_site/<out_file>` (default `index.html`).

The script extracts per-item fields when present:
- skin_name (or name/title)
- base_value (or value / market_value)
- dg (dg_value / dgValue)
- status (status / state / availability)
- image_url (image_url / image / img / url)
- context (weapon name from the "guns" structure)

Usage:
    python valuelist/scripts/generate_site_from_items.py --items valuelist/data/items_with_images.json --out-dir valuelist/mock_site --out-file index.html
"""

from __future__ import annotations
import argparse
import json
import os
import html
import re
from typing import Any, Dict, List

NAME_KEYS = ("skin_name", "name", "title")
BASE_KEYS = ("base_value", "value", "market_value")
DG_KEYS = ("dg", "dg_value", "dgValue")
STATUS_KEYS = ("status", "state", "availability")
IMAGE_KEYS = ("image_url", "image", "img", "url")


def load_json(path: str) -> Any:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def safe_get(node: Dict[str, Any], keys: tuple) -> Any:
    for k in keys:
        if k in node:
            return node[k]
    return None


def extract_items(data: Any) -> List[Dict[str, Any]]:
    items: List[Dict[str, Any]] = []
    
    # New format: data has "guns", "knives", and "gloves" as top-level keys
    # with weapon/item names as keys and arrays of items as values
    if isinstance(data, dict):
        for category in ("guns", "knives", "gloves"):
            if category not in data:
                continue
            category_data = data[category]
            if isinstance(category_data, dict):
                for weapon_name, weapon_items in category_data.items():
                    if isinstance(weapon_items, list):
                        for item in weapon_items:
                            if isinstance(item, dict):
                                # Extract fields from the item
                                name = safe_get(item, NAME_KEYS) or ""
                                base_value = safe_get(item, BASE_KEYS)
                                dg_value = safe_get(item, DG_KEYS)
                                status = safe_get(item, STATUS_KEYS)
                                image_url = safe_get(item, IMAGE_KEYS)
                                
                                # Use weapon name as context (no array indices)
                                items.append({
                                    "skin_name": name,
                                    "base_value": base_value,
                                    "dg": dg_value,
                                    "status": status,
                                    "image_url": image_url,
                                    "_context": weapon_name,
                                    "_raw": item,
                                })
    
    return items


def build_html(items: List[Dict[str, Any]]) -> str:
    # Basic styling and responsive grid
    css = """
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial; margin: 0; padding: 16px; background:#f6f7fb }
    .container { max-width: 1200px; margin: 0 auto }
    .grid { display: grid; grid-template-columns: repeat(auto-fill,minmax(260px,1fr)); gap: 12px }
    .card { background: #fff; border-radius: 8px; box-shadow: 0 1px 4px rgba(12,15,20,0.06); overflow: hidden; display:flex; flex-direction:column }
    .thumb { width:100%; height:200px; object-fit:cover; background:#eee; display:block }
    .body { padding: 12px; flex: 1 }
    .meta { font-size: 13px; color:#444; margin-top:8px }
    .muted { color:#666; font-size:12px }
    .top { display:flex; justify-content:space-between; gap:8px }
    .title { font-weight:600 }
    .footer { padding:8px 12px; background:#fafafa; border-top:1px solid #f0f0f0; font-size:12px }
    .badge { display:inline-block; padding:4px 8px; background:#f0f3ff; border-radius:6px; font-weight:600; font-size:12px }
    """

    cards = []
    for it in items:
        name = html.escape(str(it.get("skin_name") or ""))
        base = html.escape(str(it.get("base_value") or ""))
        dg = html.escape(str(it.get("dg") or ""))
        status = html.escape(str(it.get("status") or ""))
        img = str(it.get("image_url") or "")
        ctx = html.escape(str(it.get("_context") or ""))
        img_esc = html.escape(img)

        img_tag = f'<img class="thumb" src="{img_esc}" alt="{name}" loading="lazy" onerror="this.style.display=\'none\'">' if img else '<div class="thumb"></div>'

        meta_html = []
        if base:
            meta_html.append(f"<strong>{base}</strong>")
        if dg:
            meta_html.append(f"<strong>{dg}</strong>")
        if status:
            meta_html.append(f"<strong>{status}</strong>")

        cards.append(f"""
        <div class="card">
          {img_tag}
          <div class="body">
            <div class="top">
              <div class="title">{name or '&nbsp;'}</div>
              <div class="badge">{ctx or ''}</div>
            </div>
            <div class="meta">{ ' · '.join(meta_html) }</div>
          </div>
        </div>
        """)

    html_doc = f"""
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width,initial-scale=1">
        <title>Items preview</title>
        <style>{css}</style>
      </head>
      <body>
        <div class="container">
          <h1>Items</h1>
          <p class="muted">Generated from <code>valuelist/data/items_with_images.json</code>. Shows skin name, base value, dg, status and image (when available).</p>
          <div class="grid">
            {''.join(cards)}
          </div>
        </div>
      </body>
    </html>
    """
    return html_doc


def write_output(out_dir: str, out_file: str, content: str) -> None:
    os.makedirs(out_dir, exist_ok=True)
    path = os.path.join(out_dir, out_file)
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"Wrote site to: {path}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--items", default="valuelist/data/items_with_images.json", help="Path to items_with_images.json")
    ap.add_argument("--out-dir", default="valuelist/mock_site", help="Output directory for generated site")
    ap.add_argument("--out-file", default="index.html", help="Output HTML filename")
    args = ap.parse_args()

    data = load_json(args.items)
    items = extract_items(data)
    # Filter to unique items by (context + skin_name) to reduce duplicates
    seen = set()
    unique_items = []
    for it in items:
        key = (it.get("_context"), it.get("skin_name"))
        if key in seen:
            continue
        seen.add(key)
        unique_items.append(it)

    html_doc = build_html(unique_items)
    write_output(args.out_dir, args.out_file, html_doc)


if __name__ == "__main__":
    main()
