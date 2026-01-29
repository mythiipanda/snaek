"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { Check, Plus, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import type { Item, ParsedValue } from "@/lib/items-types";
import { formatParsedValueCompact, formatValueCompact, getValue } from "@/lib/items-types";
import { matchesQuery } from "@/lib/search";

type Side = "offer" | "request";

export function TradeClient({ items }: { items: Item[] }) {
  const itemsById = useMemo(() => {
    const map = new Map<string, Item>();
    for (const it of items) map.set(it.id, it);
    return map;
  }, [items]);

  const [offer, setOffer] = useState<string[]>([]);
  const [request, setRequest] = useState<string[]>([]);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSide, setPickerSide] = useState<Side>("offer");
  const [pickerQuery, setPickerQuery] = useState("");
  const [pickerSelectedIds, setPickerSelectedIds] = useState<Set<string>>(new Set());

  const openPicker = (side: Side) => {
    setPickerSide(side);
    setPickerQuery("");
    setPickerSelectedIds(new Set());
    setPickerOpen(true);
  };

  const togglePickerItem = (id: string) => {
    setPickerSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const addSelectedAndClose = () => {
    if (pickerSelectedIds.size === 0) return;
    setPickList([...pickList, ...pickerSelectedIds]);
    setPickerSelectedIds(new Set());
    setPickerOpen(false);
  };

  const selectAllInResults = () => {
    setPickerSelectedIds(new Set(pickerResults.map((it) => it.id)));
  };

  const clearPickerSelection = () => setPickerSelectedIds(new Set());

  const pickList = pickerSide === "offer" ? offer : request;
  const setPickList = pickerSide === "offer" ? setOffer : setRequest;

  const pickerResults = useMemo(() => {
    const base = items.filter((it) =>
      matchesQuery({ typeKey: it.gun, skinName: it.skin_name }, pickerQuery),
    );
    return base.slice(0, 120);
  }, [items, pickerQuery]);

  const offerTotals = useMemo(() => {
    const totals = {
      base: { min: 0, max: 0, hasPlus: false },
      dg: { min: 0, max: 0, hasPlus: false },
      ck: { min: 0, max: 0, hasPlus: false },
      upg: { min: 0, max: 0, hasPlus: false },
    };
    for (const id of offer) {
      const it = itemsById.get(id);
      if (!it) continue;
      const base = getValue(it, "base_value");
      const dg = getValue(it, "dg_value");
      const ck = getValue(it, "ck_value");
      const upg = getValue(it, "upg_value");
      if (base.min != null || base.max != null) {
        totals.base.min += base.min ?? base.max ?? 0;
        totals.base.max += base.max ?? base.min ?? 0;
      }
      if (dg.min != null || dg.max != null) {
        totals.dg.min += dg.min ?? dg.max ?? 0;
        totals.dg.max += dg.max ?? dg.min ?? 0;
      }
      if (ck.min != null || ck.max != null) {
        totals.ck.min += ck.min ?? ck.max ?? 0;
        totals.ck.max += ck.max ?? ck.min ?? 0;
      }
      if (upg.min != null || upg.max != null) {
        totals.upg.min += upg.min ?? upg.max ?? 0;
        totals.upg.max += upg.max ?? upg.min ?? 0;
      }
      totals.base.hasPlus ||= base.hasPlus;
      totals.dg.hasPlus ||= dg.hasPlus;
      totals.ck.hasPlus ||= ck.hasPlus;
      totals.upg.hasPlus ||= upg.hasPlus;
    }
    return totals;
  }, [offer, itemsById]);

  const requestTotals = useMemo(() => {
    const totals = {
      base: { min: 0, max: 0, hasPlus: false },
      dg: { min: 0, max: 0, hasPlus: false },
      ck: { min: 0, max: 0, hasPlus: false },
      upg: { min: 0, max: 0, hasPlus: false },
    };
    for (const id of request) {
      const it = itemsById.get(id);
      if (!it) continue;
      const base = getValue(it, "base_value");
      const dg = getValue(it, "dg_value");
      const ck = getValue(it, "ck_value");
      const upg = getValue(it, "upg_value");
      if (base.min != null || base.max != null) {
        totals.base.min += base.min ?? base.max ?? 0;
        totals.base.max += base.max ?? base.min ?? 0;
      }
      if (dg.min != null || dg.max != null) {
        totals.dg.min += dg.min ?? dg.max ?? 0;
        totals.dg.max += dg.max ?? dg.min ?? 0;
      }
      if (ck.min != null || ck.max != null) {
        totals.ck.min += ck.min ?? ck.max ?? 0;
        totals.ck.max += ck.max ?? ck.min ?? 0;
      }
      if (upg.min != null || upg.max != null) {
        totals.upg.min += upg.min ?? upg.max ?? 0;
        totals.upg.max += upg.max ?? upg.min ?? 0;
      }
      totals.base.hasPlus ||= base.hasPlus;
      totals.dg.hasPlus ||= dg.hasPlus;
      totals.ck.hasPlus ||= ck.hasPlus;
      totals.upg.hasPlus ||= upg.hasPlus;
    }
    return totals;
  }, [request, itemsById]);

  const diffs = {
    base: {
      min: requestTotals.base.min - offerTotals.base.max,
      max: requestTotals.base.max - offerTotals.base.min,
      hasPlus: requestTotals.base.hasPlus || offerTotals.base.hasPlus,
    },
    dg: {
      min: requestTotals.dg.min - offerTotals.dg.max,
      max: requestTotals.dg.max - offerTotals.dg.min,
      hasPlus: requestTotals.dg.hasPlus || offerTotals.dg.hasPlus,
    },
    ck: {
      min: requestTotals.ck.min - offerTotals.ck.max,
      max: requestTotals.ck.max - offerTotals.ck.min,
      hasPlus: requestTotals.ck.hasPlus || offerTotals.ck.hasPlus,
    },
    upg: {
      min: requestTotals.upg.min - offerTotals.upg.max,
      max: requestTotals.upg.max - offerTotals.upg.min,
      hasPlus: requestTotals.upg.hasPlus || offerTotals.upg.hasPlus,
    },
  };

  const formatTotal = (pv: ParsedValue) => formatParsedValueCompact(pv);

  const formatDiff = (pv: ParsedValue) => {
    const min = pv.min ?? pv.max ?? 0;
    const max = pv.max ?? pv.min ?? 0;
    if (min === 0 && max === 0) return "Even";

    const fmtSigned = (n: number) => {
      const sign = n > 0 ? "+" : n < 0 ? "-" : "";
      const abs = Math.abs(n);
      return `${sign}${formatValueCompact(abs)}`;
    };

    const core =
      min === max ? fmtSigned(min) : `${fmtSigned(min)}–${fmtSigned(max)}`;
    return `${core}${pv.hasPlus ? "+" : ""}`;
  };

  const renderSide = (side: Side) => {
    const ids = side === "offer" ? offer : request;
    const setIds = side === "offer" ? setOffer : setRequest;
    const totals = side === "offer" ? offerTotals : requestTotals;

    return (
      <Card className="h-full">
        <CardHeader className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <CardTitle className="text-base">
              {side === "offer" ? "Offer" : "Request"}
            </CardTitle>
            <Button size="sm" onClick={() => openPicker(side)}>
              <Plus className="h-4 w-4" />
              Add
            </Button>
          </div>
          <div className="grid grid-cols-4 gap-2 text-xs">
            <div className="text-muted-foreground">Base</div>
            <div className="text-muted-foreground text-center">DG</div>
            <div className="text-muted-foreground text-center">CK</div>
            <div className="text-muted-foreground text-right">UPG</div>

            <div className="font-semibold tabular-nums">
              {formatTotal(totals.base)}
            </div>
            <div className="font-semibold tabular-nums text-center">
              {formatTotal(totals.dg)}
            </div>
            <div className="font-semibold tabular-nums text-center">
              {formatTotal(totals.ck)}
            </div>
            <div className="font-semibold tabular-nums text-right">
              {formatTotal(totals.upg)}
            </div>
          </div>
        </CardHeader>
        <Separator />
        <CardContent className="p-0">
          <ScrollArea className="h-[520px]">
            <div className="p-4 grid gap-3">
              {ids.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  Add items to start calculating.
                </div>
              ) : null}

              {ids.map((id, idx) => {
                const it = itemsById.get(id);
                if (!it) return null;
                const base = getValue(it, "base_value");
                const dg = getValue(it, "dg_value");
                const ck = getValue(it, "ck_value");
                const upg = getValue(it, "upg_value");
                return (
                  <div
                    key={`${id}-${idx}`}
                    className="flex items-center gap-3 rounded-lg border p-2"
                  >
                    <div className="relative h-10 w-16 shrink-0 overflow-hidden rounded bg-muted">
                      {it.image_url ? (
                        <Image
                          src={it.image_url}
                          alt={it.skin_name}
                          fill
                          sizes="64px"
                          referrerPolicy="no-referrer"
                          className="object-contain p-1"
                        />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{it.skin_name}</div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Badge variant="secondary" className="h-5 px-2">
                          {it.gun}
                        </Badge>
                        <span className="truncate">{it.status ?? "No status"}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="grid w-[220px] grid-cols-4 gap-2 text-right text-xs tabular-nums">
                        <div className="font-semibold">
                          {formatTotal(base)}
                        </div>
                        <div className="font-semibold">
                          {formatTotal(dg)}
                        </div>
                        <div className="font-semibold">
                          {formatTotal(ck)}
                        </div>
                        <div className="font-semibold">
                          {formatTotal(upg)}
                        </div>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() =>
                          setIds(ids.filter((_, i) => i !== idx))
                        }
                        aria-label="Remove"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="grid gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-xl font-semibold tracking-tight">
            Trade ad calculator
          </div>
          <div className="text-sm text-muted-foreground">
            Pick items for Offer vs Request and compare totals.
          </div>
        </div>
      </div>

      <Card>
        <CardContent className="py-4">
          <div className="text-sm text-muted-foreground mb-2">
            Differences (Request - Offer)
          </div>
          <div className="grid grid-cols-4 gap-2 text-sm">
            <div className="text-muted-foreground">Base</div>
            <div className="text-muted-foreground text-center">DG</div>
            <div className="text-muted-foreground text-center">CK</div>
            <div className="text-muted-foreground text-right">UPG</div>

            <div className="font-semibold tabular-nums">
              {formatDiff(diffs.base)}
            </div>
            <div className="font-semibold tabular-nums text-center">
              {formatDiff(diffs.dg)}
            </div>
            <div className="font-semibold tabular-nums text-center">
              {formatDiff(diffs.ck)}
            </div>
            <div className="font-semibold tabular-nums text-right">
              {formatDiff(diffs.upg)}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {renderSide("offer")}
        {renderSide("request")}
      </div>

      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="w-full max-w-4xl sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              Add to {pickerSide === "offer" ? "Offer" : "Request"}
            </DialogTitle>
            <DialogDescription>
              Search by type (gun/knife/glove) and skin name. Click items to select multiple, then Add.
              Example: <code>m4a1 devil</code>
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center gap-3">
            <Input
              value={pickerQuery}
              onChange={(e) => setPickerQuery(e.target.value)}
              placeholder="Search…"
              autoFocus
            />
            <div className="text-xs text-muted-foreground w-28 text-right">
              Showing {pickerResults.length}
            </div>
          </div>

          <div className="rounded-md border">
            <div className="grid grid-cols-[1fr_220px] gap-3 border-b bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              <div>Item</div>
              <div className="grid grid-cols-4 gap-2 text-right tabular-nums">
                <div>Base</div>
                <div>DG</div>
                <div>CK</div>
                <div>UPG</div>
              </div>
            </div>
            <ScrollArea className="h-[60vh]">
              <div className="p-2 grid gap-2">
              {pickerResults.map((it) => {
                const base = getValue(it, "base_value");
                const dg = getValue(it, "dg_value");
                const ck = getValue(it, "ck_value");
                const upg = getValue(it, "upg_value");
                const selected = pickerSelectedIds.has(it.id);
                return (
                  <button
                    key={it.id}
                    type="button"
                    className={`flex w-full items-center gap-3 rounded-md px-2 py-2 text-left hover:bg-accent ${selected ? "bg-primary/10 ring-1 ring-primary/30" : ""}`}
                    onClick={() => togglePickerItem(it.id)}
                  >
                    <div className="relative h-10 w-16 overflow-hidden rounded bg-muted shrink-0 flex items-center justify-center">
                      {selected ? (
                        <div className="absolute inset-0 z-10 flex items-center justify-center bg-primary/20">
                          <Check className="h-6 w-6 text-primary" />
                        </div>
                      ) : null}
                      {it.image_url ? (
                        <Image
                          src={it.image_url}
                          alt={it.skin_name}
                          fill
                          sizes="64px"
                          referrerPolicy="no-referrer"
                          className="object-contain p-1"
                        />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{it.skin_name}</div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Badge variant="secondary" className="h-5 px-2">
                          {it.gun}
                        </Badge>
                        <span className="truncate">{it.status ?? "No status"}</span>
                      </div>
                    </div>
                    <div className="grid w-[220px] grid-cols-4 gap-2 text-right text-xs tabular-nums">
                      <div className="font-semibold">
                        {formatTotal(base)}
                      </div>
                      <div className="font-semibold">
                        {formatTotal(dg)}
                      </div>
                      <div className="font-semibold">
                        {formatTotal(ck)}
                      </div>
                      <div className="font-semibold">
                        {formatTotal(upg)}
                      </div>
                    </div>
                  </button>
                );
              })}
              </div>
            </ScrollArea>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={selectAllInResults}
              >
                Select all ({pickerResults.length})
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={clearPickerSelection}
                disabled={pickerSelectedIds.size === 0}
              >
                Clear selection
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                {pickerSelectedIds.size} selected
              </span>
              <Button
                type="button"
                onClick={addSelectedAndClose}
                disabled={pickerSelectedIds.size === 0}
              >
                Add {pickerSelectedIds.size > 0 ? pickerSelectedIds.size : ""} item{pickerSelectedIds.size !== 1 ? "s" : ""}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

