import { format, startOfMonth, subMonths } from "date-fns";

export type MonthTotal = { key: string; label: string; total: number; count: number };

// Money received per calendar month for the last `months` months (oldest first, this month last).
// Voided payments are ignored; months without a payment stay in the list with a zero so the chart has no gaps.
export function paymentsByMonth(
  payments: { paidAt: Date; amount: number; voidedAt: Date | null }[],
  months: number,
  now: Date,
): MonthTotal[] {
  const buckets: MonthTotal[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const m = subMonths(startOfMonth(now), i);
    buckets.push({ key: format(m, "yyyy-MM"), label: format(m, "MMM"), total: 0, count: 0 });
  }
  const byKey = new Map(buckets.map((b) => [b.key, b]));
  for (const p of payments) {
    if (p.voidedAt) continue;
    const b = byKey.get(format(p.paidAt, "yyyy-MM"));
    if (b) {
      b.total += p.amount;
      b.count += 1;
    }
  }
  return buckets;
}
