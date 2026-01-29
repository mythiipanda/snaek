"use client";

import Image from "next/image";
import { useMemo, useState } from "react";

import { Input } from "@/components/ui/input";
import { getStatusOverlayClasses } from "@/lib/status-color";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import type { Item } from "@/lib/items-types";
import { formatParsedValueCompact, parseField } from "@/lib/items-types";
import { matchesQuery } from "@/lib/search";

function formatVal(v: number | string | null | undefined) {
  if (v === null || v === undefined) return "—";
  const pv = parseField(v);
  if (pv.min != null || pv.max != null) return formatParsedValueCompact(pv);
  return String(v);
}

function SkinStatusOverlay({ status }: { status: string | null | undefined }) {
  const overlay = getStatusOverlayClasses(status);
  const label = status ?? "—";
  return (
    <span className={`inline-flex items-center gap-1.5 ${overlay.text}`}>
      <span
        className={`h-1.5 w-1.5 shrink-0 rounded-full ${overlay.dot}`}
        aria-hidden
      />
      <span className="max-w-[6rem] truncate text-[11px] font-medium">
        {label}
      </span>
    </span>
  );
}

export function SkinsClient({ items }: { items: Item[] }) {
  const [query, setQuery] = useState("");
  const [gun, setGun] = useState<string>("all");
   const [sort, setSort] = useState<"name" | "value">("value");

  const guns = useMemo(() => {
    const set = new Set<string>();
    for (const it of items) set.add(it.gun);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [items]);

  const filtered = useMemo(() => {
    const base = items.filter((it) => {
      if (gun !== "all" && it.gun !== gun) return false;
      return matchesQuery({ typeKey: it.gun, skinName: it.skin_name }, query);
    });

    const sorted = [...base];
    if (sort === "name") {
      sorted.sort((a, b) => a.skin_name.localeCompare(b.skin_name));
    } else {
      // value sort: use range (max then min) desc, then name
      sorted.sort((a, b) => {
        const pa = parseField(a.base_value as number | string | null | undefined);
        const pb = parseField(b.base_value as number | string | null | undefined);
        const aMax = pa.max ?? pa.min ?? -1;
        const bMax = pb.max ?? pb.min ?? -1;
        if (aMax !== bMax) return bMax - aMax;
        const aMin = pa.min ?? pa.max ?? -1;
        const bMin = pb.min ?? pb.max ?? -1;
        if (aMin !== bMin) return bMin - aMin;
        return a.skin_name.localeCompare(b.skin_name);
      });
    }

    return sorted;
  }, [items, query, gun, sort]);

  return (
    <div className="grid gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-xl font-semibold tracking-tight">Skins</div>
          <div className="text-sm text-muted-foreground">
            {filtered.length.toLocaleString()} results
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search skins (type + name)…"
            className="sm:w-80"
          />
          <Select value={gun} onValueChange={setGun}>
            <SelectTrigger className="sm:w-52">
              <SelectValue placeholder="Gun" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All guns</SelectItem>
              {guns.map((g) => (
                <SelectItem key={g} value={g}>
                  {g}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sort} onValueChange={(v) => setSort(v as "name" | "value")}>
            <SelectTrigger className="sm:w-40">
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="value">By value</SelectItem>
              <SelectItem value="name">A–Z</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filtered.map((it) => (
          <article
            key={it.id}
            className="group relative flex flex-col overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm ring-border/20 transition-all duration-200 hover:border-border hover:shadow-lg hover:ring-2"
          >
            {/* Image with overlay */}
            <div className="relative aspect-[4/3] w-full shrink-0 bg-muted/40">
              {it.image_url ? (
                <Image
                  src={it.image_url}
                  alt={it.skin_name}
                  fill
                  sizes="(max-width: 1280px) 50vw, 25vw"
                  referrerPolicy="no-referrer"
                  className="object-contain object-center p-5 transition-transform duration-200 group-hover:scale-[1.02]"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-muted-foreground text-xs">
                  No image
                </div>
              )}
              {/* Gradient overlay for title + meta */}
              <div
                className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/75 via-black/20 to-transparent"
                aria-hidden
              />
              {/* Title + type & status integrated in overlay */}
              <div className="absolute inset-x-0 bottom-0 flex flex-col gap-2.5 p-4 pt-10">
                <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                  {it.skin_name}
                </h3>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-medium tracking-wide text-white/95">
                    {it.gun}
                  </span>
                  <SkinStatusOverlay status={it.status} />
                </div>
              </div>
            </div>

            {/* Stats bar */}
            <div className="grid grid-cols-4 divide-x divide-border/80 border-t border-border/60 bg-muted/30">
              {[
                { label: "Base", value: formatVal(it.base_value) },
                { label: "DG", value: formatVal(it.dg_value) },
                { label: "CK", value: formatVal(it.ck_value) },
                { label: "UPG", value: formatVal(it.upg_value) },
              ].map(({ label, value }) => (
                <div
                  key={label}
                  className="flex flex-col items-center justify-center px-2 py-3 text-center"
                >
                  <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    {label}
                  </span>
                  <span className="mt-0.5 text-sm font-semibold tabular-nums text-foreground">
                    {value}
                  </span>
                </div>
              ))}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

