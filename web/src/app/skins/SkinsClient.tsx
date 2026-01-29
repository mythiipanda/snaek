"use client";

import Image from "next/image";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filtered.map((it) => (
          <Card key={it.id} className="overflow-hidden">
            <div className="relative aspect-[16/10] w-full bg-muted">
              {it.image_url ? (
                <Image
                  src={it.image_url}
                  alt={it.skin_name}
                  fill
                  sizes="(max-width: 1280px) 50vw, 25vw"
                  referrerPolicy="no-referrer"
                  className="object-contain p-3"
                />
              ) : null}
            </div>
            <CardHeader className="space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate font-semibold">{it.skin_name}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="shrink-0">
                    {it.gun}
                  </Badge>
                  <Badge variant="outline" className="shrink-0">
                    {it.status ?? "No status"}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2 text-sm">
              <div className="text-muted-foreground">Base</div>
              <div className="text-right font-medium">{formatVal(it.base_value)}</div>
              <div className="text-muted-foreground">DG</div>
              <div className="text-right font-medium">{formatVal(it.dg_value)}</div>
              <div className="text-muted-foreground">CK</div>
              <div className="text-right font-medium">{formatVal(it.ck_value)}</div>
              <div className="text-muted-foreground">UPG</div>
              <div className="text-right font-medium">{formatVal(it.upg_value)}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

