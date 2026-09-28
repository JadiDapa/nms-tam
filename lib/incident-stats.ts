import { addHours, addDays, addMonths, format, startOfDay, startOfHour, startOfMonth } from "date-fns";
import type { ResolvedRange } from "./date-range";

export type IncidentLite = { severity: string; status: string; triggeredAt: string; resolvedAt: string | null };

export type DayBucket = { key: string; label: string; critical: number; warning: number; info: number; total: number };

const DAY = 86_400_000;

// New incidents within the selected range, split by severity. Bucket width adapts to how wide the range is
// (hourly within a day, daily within ~2 months, monthly beyond that) so a "today" and a year-long custom range
// both render as a readable number of bars. Empty buckets stay in the list with zeros so the chart has no gaps.
export function incidentsByRange(incidents: IncidentLite[], range: ResolvedRange): DayBucket[] {
  const spanMs = range.to.getTime() - range.from.getTime();
  const unit = spanMs <= DAY ? "hour" : spanMs <= 62 * DAY ? "day" : "month";

  const start = unit === "hour" ? startOfHour(range.from) : unit === "day" ? startOfDay(range.from) : startOfMonth(range.from);
  const step = unit === "hour" ? (d: Date) => addHours(d, 1) : unit === "day" ? (d: Date) => addDays(d, 1) : (d: Date) => addMonths(d, 1);
  const keyFmt = unit === "hour" ? "yyyy-MM-dd'T'HH" : unit === "day" ? "yyyy-MM-dd" : "yyyy-MM";
  const labelFmt = unit === "hour" ? "HH:mm" : unit === "day" ? "dd MMM" : "MMM yyyy";

  const buckets: DayBucket[] = [];
  for (let d = start; d.getTime() <= range.to.getTime(); d = step(d)) {
    buckets.push({ key: format(d, keyFmt), label: format(d, labelFmt), critical: 0, warning: 0, info: 0, total: 0 });
  }
  const byKey = new Map(buckets.map((b) => [b.key, b]));
  for (const inc of incidents) {
    const t = new Date(inc.triggeredAt);
    if (t < range.from || t > range.to) continue;
    const b = byKey.get(format(t, keyFmt));
    if (!b) continue;
    if (inc.severity === "critical" || inc.severity === "warning" || inc.severity === "info") {
      b[inc.severity] += 1;
      b.total += 1;
    }
  }
  return buckets;
}

// Average time from start to resolution of the incidents that were resolved since `sinceMs`; null when there are none.
export function meanResolveMs(incidents: IncidentLite[], sinceMs: number): number | null {
  const spans = incidents.flatMap((i) => {
    if (i.status !== "RESOLVED" || !i.resolvedAt) return [];
    const end = new Date(i.resolvedAt).getTime();
    return end >= sinceMs ? [end - new Date(i.triggeredAt).getTime()] : [];
  });
  return spans.length ? spans.reduce((a, b) => a + b, 0) / spans.length : null;
}

const PERCENT = new Set(["cpu_pct", "memory_pct", "icmp_packet_loss_pct"]);

// The reading that raised an incident, written for a person ("94.1%", "343 ms"); null when there was no number.
export function formatReading(metric: string | null, value: number | null): string | null {
  if (value === null) return null;
  if (metric && PERCENT.has(metric)) return `${value.toFixed(1)}%`;
  if (metric && metric.endsWith("_ms")) return `${Math.round(value)} ms`;
  return String(Math.round(value * 10) / 10);
}
