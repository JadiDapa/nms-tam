import { endOfDay, startOfDay, startOfMonth, startOfWeek } from "date-fns";

export const RANGE_PRESETS = ["today", "week", "month", "custom"] as const;
export type RangePreset = (typeof RANGE_PRESETS)[number];

export const PRESET_LABEL: Record<RangePreset, string> = {
  today: "Today",
  week: "This week",
  month: "This month",
  custom: "Custom range",
};

export type ResolvedRange = {
  preset: RangePreset;
  from: Date;
  to: Date;
  bucketSec: number;
  label: string;
};

/** Target point count for a chart: enough to show real movement and fluctuation, not so many the chart is noise. */
const TARGET_POINTS = 200;
/** Never bucket finer than this — matches the engine's own bucketSec floor (nms-monitoring/src/api/routes/devices.ts). */
const MIN_BUCKET_SEC = 5;
/** Never bucket coarser than this (31 days) — the engine's bucketSec ceiling. */
const MAX_BUCKET_SEC = 31 * 86_400;

// Always aims for ~200 evenly-spaced points across the selected range, however wide or narrow it is, so the chart
// shows real fluctuation instead of being flattened into one blob (a short range) or a single point (a long one).
function bucketFor(spanMs: number): number {
  const raw = Math.ceil(spanMs / TARGET_POINTS / 1000);
  return Math.min(MAX_BUCKET_SEC, Math.max(MIN_BUCKET_SEC, raw));
}

// Formats a Date as the calendar day it represents on this clock (its own y/m/d fields), never converting through
// UTC — `toISOString().slice(0, 10)` shifts to a different day whenever the caller's UTC offset isn't 0.
export const dateKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// Turns a "yyyy-MM-dd" key back into that calendar day at local midnight. `new Date("yyyy-MM-dd")` would parse it
// as UTC midnight instead (a different instant, and a different day once redisplayed in a non-UTC timezone) — the
// other half of the round trip `dateKey` exists to avoid.
function parseDateKey(key: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

// Reads ?range=today|week|month|custom (+ from/to for custom) from a page's searchParams into a concrete
// {from, to, bucketSec} window. Falls back to "today" for anything missing or malformed.
export function resolveDateRange(sp: { range?: string; from?: string; to?: string }): ResolvedRange {
  const now = new Date();
  const preset = RANGE_PRESETS.includes(sp.range as RangePreset) ? (sp.range as RangePreset) : "today";

  if (preset === "custom" && sp.from) {
    const fromDay = parseDateKey(sp.from);
    const toDay = sp.to ? parseDateKey(sp.to) : now;
    if (fromDay && toDay) {
      const from = startOfDay(fromDay);
      const to = endOfDay(toDay);
      if (from <= to) return { preset, from, to, bucketSec: bucketFor(to.getTime() - from.getTime()), label: PRESET_LABEL.custom };
    }
  }

  if (preset === "week") {
    const from = startOfWeek(now, { weekStartsOn: 1 });
    return { preset, from, to: now, bucketSec: bucketFor(now.getTime() - from.getTime()), label: PRESET_LABEL.week };
  }
  if (preset === "month") {
    const from = startOfMonth(now);
    return { preset, from, to: now, bucketSec: bucketFor(now.getTime() - from.getTime()), label: PRESET_LABEL.month };
  }
  const from = startOfDay(now);
  return { preset: "today", from, to: now, bucketSec: bucketFor(now.getTime() - from.getTime()), label: PRESET_LABEL.today };
}

// The ?range=...&from=...&to=... pairs that reproduce a range, for building links/query strings.
export function rangeParams(r: Pick<ResolvedRange, "preset" | "from" | "to">): Record<string, string> {
  if (r.preset === "custom") return { range: "custom", from: dateKey(r.from), to: dateKey(r.to) };
  return { range: r.preset };
}

// A fixed lookback window not tied to any picker (dashboard widgets that always show "right now").
export function lastNMs(ms: number, bucketSec?: number): ResolvedRange {
  const to = new Date();
  return { preset: "custom", from: new Date(to.getTime() - ms), to, bucketSec: bucketSec ?? bucketFor(ms), label: "" };
}
