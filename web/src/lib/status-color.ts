/**
 * Status color tier: bad (red), mid (yellow), decent (yellow-green), good (green).
 * Other statuses (e.g. TSTHAS, "Item doesn't exist") use neutral.
 */
export type StatusTier = "bad" | "mid" | "decent" | "good" | "neutral";

const BAD_PREFIXES = ["bad", "bad/", "item doesn't exist", "too big of an item"];
const GOOD_PREFIXES = ["good"];
const MID_PREFIXES = ["mid", "mid/"];
const DECENT_PREFIXES = ["decent", "decent/"]; // "Decent/Good" -> decent

/** Normalize status for matching: lowercase, trimmed. */
function norm(s: string): string {
  return s.trim().toLowerCase();
}

/**
 * Returns the color tier for a status string.
 * Data has: Bad, Bad/Mid, Good, Good Red, Decent, Decent/Good, Mid, Mid/Decent, TSTHAS, etc.
 */
export function getStatusTier(status: string | null | undefined): StatusTier {
  if (status == null || status === "") return "neutral";
  const n = norm(status);
  if (BAD_PREFIXES.some((p) => n.startsWith(p))) return "bad";
  if (GOOD_PREFIXES.some((p) => n.startsWith(p))) return "good";
  if (MID_PREFIXES.some((p) => n.startsWith(p))) return "mid";
  if (DECENT_PREFIXES.some((p) => n.startsWith(p))) return "decent";
  return "neutral";
}

/** Tailwind classes for status badge background + text (readable on both light/dark). */
const TIER_CLASSES: Record<StatusTier, string> = {
  bad: "bg-red-500/20 text-red-700 dark:text-red-300 border-red-500/40",
  mid: "bg-yellow-500/20 text-yellow-700 dark:text-yellow-300 border-yellow-500/40",
  decent:
    "bg-lime-500/20 text-lime-700 dark:text-lime-300 border-lime-500/40",
  good:
    "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/40",
  neutral:
    "bg-muted text-muted-foreground border-border",
};

export function getStatusBadgeClassName(status: string | null | undefined): string {
  const tier = getStatusTier(status);
  return TIER_CLASSES[tier];
}

/** Dot + text for overlay: light mode (on light gradient) and dark mode (on dark gradient). */
const TIER_OVERLAY_CLASSES: Record<
  StatusTier,
  { dot: string; text: string }
> = {
  bad: {
    dot: "bg-red-500 dark:bg-red-400",
    text: "text-red-800 dark:text-red-300",
  },
  mid: {
    dot: "bg-amber-500 dark:bg-amber-400",
    text: "text-amber-800 dark:text-amber-300",
  },
  decent: {
    dot: "bg-lime-600 dark:bg-lime-400",
    text: "text-lime-800 dark:text-lime-300",
  },
  good: {
    dot: "bg-emerald-600 dark:bg-emerald-400",
    text: "text-emerald-800 dark:text-emerald-300",
  },
  neutral: {
    dot: "bg-gray-500 dark:bg-white/50",
    text: "text-gray-700 dark:text-white/70",
  },
};

export function getStatusOverlayClasses(status: string | null | undefined) {
  const tier = getStatusTier(status);
  return TIER_OVERLAY_CLASSES[tier];
}
