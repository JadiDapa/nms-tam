import { format, startOfDay, subDays } from "date-fns";

export type IncidentLite = { severity: string; status: string; triggeredAt: string; resolvedAt: string | null };

export type DayBucket = { key: string; label: string; critical: number; warning: number; info: number; total: number };

// How many incidents started on each of the last `days` days (oldest first, today last), split by severity.
// Days without incidents stay in the list with zeros so the chart has no gaps.
export function incidentsByDay(incidents: IncidentLite[], days: number, now: Date): DayBucket[] {
  const buckets: DayBucket[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = subDays(startOfDay(now), i);
    buckets.push({ key: format(d, "yyyy-MM-dd"), label: format(d, "dd MMM"), critical: 0, warning: 0, info: 0, total: 0 });
  }
  const byKey = new Map(buckets.map((b) => [b.key, b]));
  for (const inc of incidents) {
    const b = byKey.get(format(new Date(inc.triggeredAt), "yyyy-MM-dd"));
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
