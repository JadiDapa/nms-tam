import { addDays, addMonths, format, startOfDay, startOfMonth } from "date-fns";
import type { ResolvedRange } from "@/lib/date-range";

export type MonthTotal = { key: string; label: string; total: number; count: number };

const DAY = 86_400_000;

// Money received within the selected range. Bucketed by day for a range up to ~2 months (so "today" and "this
// week" show something), by calendar month beyond that. Voided payments are ignored; empty buckets stay in the
// list with a zero so the chart has no gaps.
export function paymentsByRange(payments: { paidAt: Date; amount: number; voidedAt: Date | null }[], range: ResolvedRange): MonthTotal[] {
  const spanMs = range.to.getTime() - range.from.getTime();
  const byMonth = spanMs > 62 * DAY;

  const start = byMonth ? startOfMonth(range.from) : startOfDay(range.from);
  const step = byMonth ? (d: Date) => addMonths(d, 1) : (d: Date) => addDays(d, 1);
  const keyFmt = byMonth ? "yyyy-MM" : "yyyy-MM-dd";
  const labelFmt = byMonth ? "MMM" : "dd MMM";

  const buckets: MonthTotal[] = [];
  for (let d = start; d.getTime() <= range.to.getTime(); d = step(d)) {
    buckets.push({ key: format(d, keyFmt), label: format(d, labelFmt), total: 0, count: 0 });
  }
  const byKey = new Map(buckets.map((b) => [b.key, b]));
  for (const p of payments) {
    if (p.voidedAt) continue;
    if (p.paidAt < range.from || p.paidAt > range.to) continue;
    const b = byKey.get(format(p.paidAt, keyFmt));
    if (b) {
      b.total += p.amount;
      b.count += 1;
    }
  }
  return buckets;
}
