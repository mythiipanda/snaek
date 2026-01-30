"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { getStatusOverlayClasses, getStatusTier } from "@/lib/status-color";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import type { Item } from "@/lib/items-types";
import { formatParsedValueCompact, formatValueCompact, parseField } from "@/lib/items-types";
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
  const [sort, setSort] = useState<"name" | "value" | "status">("value");
  const [showRangeFilters, setShowRangeFilters] = useState(false);

  // Calculate min/max values for slider
  const { minValue, maxValue } = useMemo(() => {
    let min = Infinity;
    let max = -Infinity;
    for (const it of items) {
      const pv = parseField(it.base_value as number | string | null | undefined);
      const itemMin = pv.min ?? pv.max ?? null;
      const itemMax = pv.max ?? pv.min ?? null;
      if (itemMin != null && Number.isFinite(itemMin)) {
        min = Math.min(min, itemMin);
        max = Math.max(max, itemMin);
      }
      if (itemMax != null && Number.isFinite(itemMax)) {
        min = Math.min(min, itemMax);
        max = Math.max(max, itemMax);
      }
    }
    return {
      minValue: Number.isFinite(min) ? min : 0,
      maxValue: Number.isFinite(max) ? max : 1000000,
    };
  }, [items]);

  const [valueRange, setValueRange] = useState<number[]>([0, 1000000]);
  const [minInput, setMinInput] = useState<string>("");
  const [maxInput, setMaxInput] = useState<string>("");

  // Update valueRange when min/max values are calculated
  useEffect(() => {
    setValueRange([minValue, maxValue]);
    setMinInput(formatValueCompact(minValue));
    setMaxInput(formatValueCompact(maxValue));
  }, [minValue, maxValue]);

  // Sync input fields when slider changes (user drags slider)
  // Use a ref to track if user is currently editing inputs
  const [isEditingMin, setIsEditingMin] = useState(false);
  const [isEditingMax, setIsEditingMax] = useState(false);

  useEffect(() => {
    if (!isEditingMin) {
      setMinInput(formatValueCompact(valueRange[0]));
    }
  }, [valueRange[0], isEditingMin]);

  useEffect(() => {
    if (!isEditingMax) {
      setMaxInput(formatValueCompact(valueRange[1]));
    }
  }, [valueRange[1], isEditingMax]);

  // Parse compact format back to number (e.g., "1.5k" -> 1500, "2M" -> 2000000)
  function parseCompactValue(str: string): number | null {
    const trimmed = str.trim().toLowerCase();
    if (!trimmed) return null;
    
    // Remove commas and spaces
    const cleaned = trimmed.replace(/[, ]/g, "");
    
    // Handle K suffix (case insensitive)
    const kMatch = cleaned.match(/^([\d.]+)\s*k$/);
    if (kMatch) {
      const num = Number.parseFloat(kMatch[1]);
      if (Number.isFinite(num)) return num * 1000;
    }
    
    // Handle M suffix (case insensitive)
    const mMatch = cleaned.match(/^([\d.]+)\s*m$/);
    if (mMatch) {
      const num = Number.parseFloat(mMatch[1]);
      if (Number.isFinite(num)) return num * 1000000;
    }
    
    // Regular number (with or without commas)
    const numStr = cleaned.replace(/,/g, "");
    const num = Number.parseFloat(numStr);
    return Number.isFinite(num) ? num : null;
  }

  function handleMinInputChange(value: string) {
    setIsEditingMin(true);
    setMinInput(value);
    const parsed = parseCompactValue(value);
    if (parsed != null && parsed >= minValue && parsed <= valueRange[1]) {
      setValueRange([parsed, valueRange[1]]);
    }
  }

  function handleMaxInputChange(value: string) {
    setIsEditingMax(true);
    setMaxInput(value);
    const parsed = parseCompactValue(value);
    if (parsed != null && parsed <= maxValue && parsed >= valueRange[0]) {
      setValueRange([valueRange[0], parsed]);
    }
  }

  function handleMinInputBlur() {
    setIsEditingMin(false);
    const parsed = parseCompactValue(minInput);
    if (parsed == null || parsed < minValue || parsed > valueRange[1]) {
      // Reset to current slider value
      setMinInput(formatValueCompact(valueRange[0]));
    } else {
      // Format the valid value
      setMinInput(formatValueCompact(parsed));
    }
  }

  function handleMaxInputBlur() {
    setIsEditingMax(false);
    const parsed = parseCompactValue(maxInput);
    if (parsed == null || parsed > maxValue || parsed < valueRange[0]) {
      // Reset to current slider value
      setMaxInput(formatValueCompact(valueRange[1]));
    } else {
      // Format the valid value
      setMaxInput(formatValueCompact(parsed));
    }
  }

  const guns = useMemo(() => {
    const set = new Set<string>();
    for (const it of items) set.add(it.gun);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [items]);

  const filtered = useMemo(() => {
    const base = items.filter((it) => {
      if (gun !== "all" && it.gun !== gun) return false;
      if (!matchesQuery({ typeKey: it.gun, skinName: it.skin_name }, query)) return false;
      
      // Filter by value range
      const pv = parseField(it.base_value as number | string | null | undefined);
      const itemMin = pv.min ?? pv.max ?? null;
      const itemMax = pv.max ?? pv.min ?? null;
      if (itemMin != null && Number.isFinite(itemMin) && itemMax != null && Number.isFinite(itemMax)) {
        // Item has a range - check if it overlaps with filter range
        if (itemMax < valueRange[0] || itemMin > valueRange[1]) return false;
      } else if (itemMin != null && Number.isFinite(itemMin)) {
        // Single value
        if (itemMin < valueRange[0] || itemMin > valueRange[1]) return false;
      } else {
        // No valid value - exclude if filtering is active
        if (valueRange[0] !== minValue || valueRange[1] !== maxValue) return false;
      }
      
      return true;
    });

    const sorted = [...base];
    if (sort === "name") {
      sorted.sort((a, b) => a.skin_name.localeCompare(b.skin_name));
    } else if (sort === "status") {
      // status sort: by tier (good > decent > mid > bad > neutral), then by status name, then by name
      const tierOrder: Record<string, number> = { good: 0, decent: 1, mid: 2, bad: 3, neutral: 4 };
      sorted.sort((a, b) => {
        const aTier = getStatusTier(a.status);
        const bTier = getStatusTier(b.status);
        const aTierOrder = tierOrder[aTier] ?? 4;
        const bTierOrder = tierOrder[bTier] ?? 4;
        if (aTierOrder !== bTierOrder) return aTierOrder - bTierOrder;
        const aStatus = a.status ?? "";
        const bStatus = b.status ?? "";
        const statusCmp = aStatus.localeCompare(bStatus);
        if (statusCmp !== 0) return statusCmp;
        return a.skin_name.localeCompare(b.skin_name);
      });
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
  }, [items, query, gun, sort, valueRange, minValue, maxValue]);

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
          <Select value={sort} onValueChange={(v) => setSort(v as "name" | "value" | "status")}>
            <SelectTrigger className="sm:w-40">
              <SelectValue placeholder="Sort" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="value">By value</SelectItem>
              <SelectItem value="name">A–Z</SelectItem>
              <SelectItem value="status">By status</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="default"
            onClick={() => setShowRangeFilters(!showRangeFilters)}
            className="sm:w-auto"
          >
            Range Filters
            <ChevronDown
              className={`h-4 w-4 transition-transform ${showRangeFilters ? "rotate-180" : ""}`}
            />
          </Button>
        </div>
      </div>

      {/* Value Range Slider - Collapsible */}
      {showRangeFilters && (
        <div className="rounded-lg border border-border/60 bg-card p-4 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex-1">
              <Slider
                value={valueRange}
                onValueChange={setValueRange}
                min={minValue}
                max={maxValue}
                step={Math.max(1, Math.floor((maxValue - minValue) / 1000))}
                className="w-full"
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-muted-foreground whitespace-nowrap">Min</label>
              <Input
                type="text"
                value={minInput}
                onChange={(e) => handleMinInputChange(e.target.value)}
                onBlur={handleMinInputBlur}
                className="w-24 text-sm tabular-nums"
                placeholder={formatValueCompact(minValue)}
              />
            </div>
            <span className="text-sm text-muted-foreground">–</span>
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-muted-foreground whitespace-nowrap">Max</label>
              <Input
                type="text"
                value={maxInput}
                onChange={(e) => handleMaxInputChange(e.target.value)}
                onBlur={handleMaxInputBlur}
                className="w-24 text-sm tabular-nums"
                placeholder={formatValueCompact(maxValue)}
              />
            </div>
            <div className="ml-auto text-xs text-muted-foreground tabular-nums">
              {formatValueCompact(valueRange[0])} – {formatValueCompact(valueRange[1])}
            </div>
          </div>
        </div>
      )}

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
              {/* Gradient overlay: light = soft white fade, dark = dark fade */}
              <div
                className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-white/90 via-white/30 to-transparent dark:from-black/75 dark:via-black/20 dark:to-transparent"
                aria-hidden
              />
              {/* Title + type & status integrated in overlay */}
              <div className="absolute inset-x-0 bottom-0 flex flex-col gap-2.5 p-4 pt-10">
                <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-gray-900 drop-shadow-[0_1px_2px_rgba(255,255,255,0.8)] dark:text-white dark:drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                  {it.skin_name}
                </h3>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-gray-900/15 px-2.5 py-1 text-[11px] font-medium tracking-wide text-gray-900 dark:bg-white/15 dark:text-white/95">
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

