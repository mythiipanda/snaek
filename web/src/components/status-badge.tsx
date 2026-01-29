"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getStatusBadgeClassName } from "@/lib/status-color";

type StatusBadgeProps = {
  status: string | null | undefined;
  className?: string;
  /** When true, use smaller text and padding (e.g. for skins grid). */
  compact?: boolean;
};

export function StatusBadge({ status, className, compact }: StatusBadgeProps) {
  const label = status ?? "No status";
  const colorClass = getStatusBadgeClassName(status);
  return (
    <Badge
      variant="outline"
      className={cn(
        "border font-medium",
        colorClass,
        compact && "max-w-[7rem] shrink-0 truncate text-[10px] px-1.5 py-0 h-4",
        className
      )}
    >
      {label}
    </Badge>
  );
}
