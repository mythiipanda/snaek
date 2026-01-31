"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getStatusOverlayClasses } from "@/lib/status-color";

import type { Item, ParsedValue } from "@/lib/items-types";
import {
  formatParsedValueCompact,
  formatValueCompact,
  getValue,
} from "@/lib/items-types";
import { matchesQuery } from "@/lib/search";

type Side = "offer" | "request";

function StatusOverlay({ status, compact }: { status: string | null | undefined; compact?: boolean }) {
  const overlay = getStatusOverlayClasses(status);
  const label = status ?? "—";
  return (
    <span className={`inline-flex items-center gap-1 ${overlay.text} ${compact ? "text-[10px]" : "text-xs"}`}>
      <span className={`shrink-0 rounded-full ${overlay.dot} ${compact ? "h-1 w-1" : "h-1.5 w-1.5"}`} aria-hidden />
      <span className={`max-w-[5rem] truncate font-medium ${compact ? "text-[10px]" : "text-xs"}`}>{label}</span>
    </span>
  );
}

const SLOTS_PER_SIDE = 4;

/** Compact skin card: image + name/gun/status + Base/DG/CK/UPG. Rolimon-style. */
function SkinCard({
  item,
  onRemove,
  onClick,
  interactive,
  compact,
}: {
  item: Item;
  onRemove?: () => void;
  onClick?: () => void;
  interactive?: boolean;
  compact?: boolean;
}) {
  const base = getValue(item, "base_value");
  const dg = getValue(item, "dg_value");
  const ck = getValue(item, "ck_value");
  const upg = getValue(item, "upg_value");
  const formatTotal = (pv: ParsedValue) => formatParsedValueCompact(pv);

  return (
    <article
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={interactive ? onClick : undefined}
      onKeyDown={
        interactive && onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      className={`group relative flex flex-col overflow-hidden rounded-lg border border-border/60 bg-card shadow-sm transition-all hover:border-border hover:shadow ${
        interactive ? "cursor-pointer" : ""
      } ${compact ? "rounded-md" : ""}`}
    >
      <div className={`relative w-full shrink-0 bg-muted/40 ${compact ? "aspect-[4/3] max-h-20" : "aspect-[4/3]"}`}>
        {item.image_url ? (
          <Image
            src={item.image_url}
            alt={item.skin_name}
            fill
            sizes={compact ? "120px" : "(max-width: 1280px) 50vw, 25vw"}
            referrerPolicy="no-referrer"
            className={`object-contain object-center transition-transform group-hover:scale-[1.02] ${compact ? "p-1" : "p-3"}`}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground text-xs">
            No image
          </div>
        )}
        <div
          className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-white/90 via-white/30 to-transparent dark:from-black/75 dark:via-black/20 dark:to-transparent"
          aria-hidden
        />
        <div className={`absolute inset-x-0 bottom-0 flex flex-col gap-0.5 p-1.5 pt-5 ${compact ? "pt-4" : "pt-8"}`}>
          <h3 className={`line-clamp-1 font-semibold leading-tight text-gray-900 drop-shadow-[0_1px_2px_rgba(255,255,255,0.8)] dark:text-white dark:drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)] ${compact ? "text-xs" : "text-sm"}`}>
            {item.skin_name}
          </h3>
          <div className="flex flex-wrap items-center gap-1">
            <span className={`rounded-full bg-gray-900/15 px-1.5 py-0.5 font-medium tracking-wide text-gray-900 dark:bg-white/15 dark:text-white/95 ${compact ? "text-[10px]" : "text-xs"}`}>
              {item.gun}
            </span>
            <StatusOverlay status={item.status} compact={compact} />
          </div>
        </div>
        {onRemove && (
          <button
            type="button"
            className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            aria-label="Remove"
          >
            <Minus className="h-8 w-8 text-white drop-shadow-md" strokeWidth={2.5} />
          </button>
        )}
      </div>
      <div className={`grid grid-cols-4 divide-x divide-border/80 border-t border-border/60 bg-muted/30 ${compact ? "py-2 px-1.5" : "py-2 px-1"}`}>
        {[
          { label: "Base", value: formatTotal(base) },
          { label: "DG", value: formatTotal(dg) },
          { label: "CK", value: formatTotal(ck) },
          { label: "UPG", value: formatTotal(upg) },
        ].map(({ label, value }) => (
          <div
            key={label}
            className={`flex flex-col items-center justify-center text-center ${compact ? "py-0.5" : "px-1 py-0.5"}`}
          >
            <span className={`font-medium uppercase tracking-wider text-muted-foreground ${compact ? "text-xs" : "text-xs"}`}>
              {label}
            </span>
            <span className={`font-semibold tabular-nums text-foreground ${compact ? "text-xs" : "text-sm"}`}>
              {value}
            </span>
          </div>
        ))}
      </div>
    </article>
  );
}

export function TradeClient({ items }: { items: Item[] }) {
  const itemsById = useMemo(() => {
    const map = new Map<string, Item>();
    for (const it of items) map.set(it.id, it);
    return map;
  }, [items]);

  const [offer, setOffer] = useState<string[]>([]);
  const [request, setRequest] = useState<string[]>([]);

  const [addMode, setAddMode] = useState<Side | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const toggleAddMode = (side: Side) => {
    setAddMode((prev) => (prev === side ? null : side));
  };

  const addItemToSide = (id: string) => {
    if (addMode === null) return;
    if (addMode === "offer") setOffer((prev) => [...prev, id]);
    else setRequest((prev) => [...prev, id]);
  };

  const removeFromSide = (side: Side, index: number) => {
    if (side === "offer") setOffer((prev) => prev.filter((_, i) => i !== index));
    else setRequest((prev) => prev.filter((_, i) => i !== index));
  };

  const gridItems = useMemo(() => {
    const filtered = items.filter((it) =>
      matchesQuery({ typeKey: it.gun, skinName: it.skin_name }, searchQuery),
    );
    const sorted = [...filtered].sort((a, b) => {
      const pa = getValue(a, "base_value");
      const pb = getValue(b, "base_value");
      const aMax = pa.max ?? pa.min ?? -1;
      const bMax = pb.max ?? pb.min ?? -1;
      if (bMax !== aMax) return bMax - aMax;
      const aMin = pa.min ?? pa.max ?? -1;
      const bMin = pb.min ?? pb.max ?? -1;
      return bMin - aMin;
    });
    return sorted.slice(0, 200);
  }, [items, searchQuery]);

  const offerTotals = useMemo(() => computeTotals(offer, itemsById), [offer, itemsById]);
  const requestTotals = useMemo(() => computeTotals(request, itemsById), [request, itemsById]);

  const diffs = useMemo(
    () => ({
      base: diffParsed(requestTotals.base, offerTotals.base),
      dg: diffParsed(requestTotals.dg, offerTotals.dg),
      ck: diffParsed(requestTotals.ck, offerTotals.ck),
      upg: diffParsed(requestTotals.upg, offerTotals.upg),
    }),
    [offerTotals, requestTotals],
  );

  const formatTotal = (pv: ParsedValue) => formatParsedValueCompact(pv);
  const formatDiff = (pv: ParsedValue) => {
    const min = pv.min ?? pv.max ?? 0;
    const max = pv.max ?? pv.min ?? 0;
    if (min === 0 && max === 0) return "Even";
    const fmt = (n: number) =>
      `${n > 0 ? "+" : n < 0 ? "-" : ""}${formatValueCompact(Math.abs(n))}`;
    const core = min === max ? fmt(min) : `${fmt(min)}–${fmt(max)}`;
    return `${core}${pv.hasPlus ? "+" : ""}`;
  };

  const renderSide = (side: Side) => {
    const ids = side === "offer" ? offer : request;
    const totals = side === "offer" ? offerTotals : requestTotals;
    const isSelecting = addMode === side;

    const slotCount = Math.max(SLOTS_PER_SIDE, ids.length + 1);

    return (
      <Card className="h-full flex flex-col">
        <CardContent className="flex flex-1 flex-col gap-2 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold">
              {side === "offer" ? "Offer" : "Request"}
            </h2>
            <div className="flex items-center gap-3 text-xs">
              <span className="text-muted-foreground">Base <span className="font-semibold tabular-nums text-foreground">{formatTotal(totals.base)}</span></span>
              <span className="text-muted-foreground">DG <span className="font-semibold tabular-nums text-foreground">{formatTotal(totals.dg)}</span></span>
              <span className="text-muted-foreground">CK <span className="font-semibold tabular-nums text-foreground">{formatTotal(totals.ck)}</span></span>
              <span className="text-muted-foreground">UPG <span className="font-semibold tabular-nums text-foreground">{formatTotal(totals.upg)}</span></span>
            </div>
          </div>

          <ScrollArea className="flex-1 pr-1">
            <div className="grid grid-cols-2 gap-2">
              {Array.from({ length: slotCount }, (_, i) => {
                const id = ids[i];
                const it = id ? itemsById.get(id) : null;
                if (it) {
                  return (
                    <SkinCard
                      key={`${id}-${i}`}
                      item={it}
                      compact
                      onRemove={() => removeFromSide(side, i)}
                    />
                  );
                }
                const isAddSlot = i === ids.length;
                return (
                  <button
                    key={`empty-${side}-${i}`}
                    type="button"
                    onClick={() => toggleAddMode(side)}
                    className={`group relative flex min-h-[92px] flex-col items-center justify-center rounded-lg border-2 border-dashed transition-colors ${
                      isSelecting
                        ? "border-primary/60 bg-primary/10 text-primary"
                        : "border-muted-foreground/40 bg-muted/20 text-muted-foreground hover:border-muted-foreground/60 hover:bg-muted/30"
                    }`}
                  >
                    {isSelecting ? (
                      <>
                        <span className="text-xs font-medium">Select</span>
                        <span className="mt-0.5 text-[10px] opacity-80">Click items below</span>
                      </>
                    ) : (
                      <>
                        <span className="flex h-8 w-8 items-center justify-center transition-all group-hover:scale-110">
                          <Plus className="h-6 w-6 opacity-60 group-hover:opacity-100" />
                        </span>
                        <span className="mt-1.5 text-xs font-medium">Add</span>
                      </>
                    )}
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <header>
        <h1 className="text-xl font-semibold tracking-tight">Trade calculator</h1>
        <p className="mt-1 text-xs text-muted-foreground">
          Click empty slot (hover +), then click items below. Click slot again to finish.
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        {renderSide("offer")}
        {renderSide("request")}
      </div>

      <Card>
        <CardContent className="flex flex-row flex-wrap items-center gap-x-4 gap-y-1 py-2.5 px-4">
          <span className="text-sm font-medium text-muted-foreground">Differences (Request − Offer)</span>
          <span className="text-sm text-muted-foreground">Base <span className="font-semibold tabular-nums text-foreground">{formatDiff(diffs.base)}</span></span>
          <span className="text-sm text-muted-foreground">DG <span className="font-semibold tabular-nums text-foreground">{formatDiff(diffs.dg)}</span></span>
          <span className="text-sm text-muted-foreground">CK <span className="font-semibold tabular-nums text-foreground">{formatDiff(diffs.ck)}</span></span>
          <span className="text-sm text-muted-foreground">UPG <span className="font-semibold tabular-nums text-foreground">{formatDiff(diffs.upg)}</span></span>
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          id="trade-search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search (e.g. ak47 devil)"
          className="h-9 w-64 text-sm"
        />
        <span className="text-xs text-muted-foreground">{gridItems.length} items</span>
      </div>

      <ScrollArea className="h-[50vh] rounded-lg border">
        <div className="grid grid-cols-3 gap-2 p-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
          {gridItems.map((it) => {
            const clickable = addMode !== null;
            return (
              <SkinCard
                key={it.id}
                item={it}
                compact
                interactive={clickable}
                onClick={() => clickable && addItemToSide(it.id)}
              />
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}

function computeTotals(
  ids: string[],
  itemsById: Map<string, Item>,
): Record<"base" | "dg" | "ck" | "upg", ParsedValue> {
  const totals = {
    base: { min: 0, max: 0, hasPlus: false },
    dg: { min: 0, max: 0, hasPlus: false },
    ck: { min: 0, max: 0, hasPlus: false },
    upg: { min: 0, max: 0, hasPlus: false },
  };
  for (const id of ids) {
    const it = itemsById.get(id);
    if (!it) continue;
    for (const key of ["base_value", "dg_value", "ck_value", "upg_value"] as const) {
      const k = key.replace("_value", "") as "base" | "dg" | "ck" | "upg";
      const v = getValue(it, key);
      if (v.min != null || v.max != null) {
        totals[k].min += v.min ?? v.max ?? 0;
        totals[k].max += v.max ?? v.min ?? 0;
      }
      totals[k].hasPlus ||= v.hasPlus;
    }
  }
  return totals;
}

function diffParsed(req: ParsedValue, off: ParsedValue): ParsedValue {
  return {
    min: (req.min ?? req.max ?? 0) - (off.max ?? off.min ?? 0),
    max: (req.max ?? req.min ?? 0) - (off.min ?? off.max ?? 0),
    hasPlus: req.hasPlus || off.hasPlus,
  };
}
