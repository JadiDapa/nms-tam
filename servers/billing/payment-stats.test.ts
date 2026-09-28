import { describe, expect, it } from "vitest";
import { paymentsByRange } from "./payment-stats";
import type { ResolvedRange } from "@/lib/date-range";

describe("paymentsByRange", () => {
  const now = new Date(2026, 8, 21); // 21 Sep 2026
  const pay = (y: number, m: number, d: number, amount: number, voided = false) => ({
    paidAt: new Date(y, m, d),
    amount,
    voidedAt: voided ? new Date(y, m, d + 1) : null,
  });
  // A range wide enough to bucket by calendar month (> ~2 months), spanning Jul-Sep 2026.
  const monthRange = (to = now): ResolvedRange => ({ preset: "custom", from: new Date(2026, 6, 1), to, bucketSec: 86_400, label: "" });

  it("lists every month of the window, oldest first, even without payments", () => {
    const r = paymentsByRange([], monthRange());
    expect(r.map((b) => b.key)).toEqual(["2026-07", "2026-08", "2026-09"]);
    expect(r.every((b) => b.total === 0 && b.count === 0)).toBe(true);
  });

  it("adds up the payments of a month and counts them", () => {
    const r = paymentsByRange([pay(2026, 8, 1, 300_000), pay(2026, 8, 20, 50_000), pay(2026, 7, 5, 300_000)], monthRange());
    expect(r.find((b) => b.key === "2026-09")).toMatchObject({ total: 350_000, count: 2 });
    expect(r.find((b) => b.key === "2026-08")).toMatchObject({ total: 300_000, count: 1 });
    expect(r.find((b) => b.key === "2026-07")).toMatchObject({ total: 0, count: 0 });
  });

  it("ignores voided payments and payments outside the window", () => {
    const r = paymentsByRange([pay(2026, 8, 2, 999_000, true), pay(2026, 3, 2, 123_000), pay(2026, 8, 3, 10_000)], monthRange());
    expect(r.reduce((s, b) => s + b.total, 0)).toBe(10_000);
  });

  it("crosses a year boundary", () => {
    const range: ResolvedRange = { preset: "custom", from: new Date(2025, 10, 1), to: new Date(2026, 0, 10), bucketSec: 86_400, label: "" };
    const r = paymentsByRange([pay(2025, 11, 15, 1)], range);
    expect(r.map((b) => b.key)).toEqual(["2025-11", "2025-12", "2026-01"]);
    expect(r[1].total).toBe(1);
  });

  it("buckets by day when the range is short", () => {
    const range: ResolvedRange = { preset: "week", from: new Date(2026, 8, 15), to: new Date(2026, 8, 21), bucketSec: 1_800, label: "" };
    const r = paymentsByRange([pay(2026, 8, 16, 100_000)], range);
    expect(r.map((b) => b.key)).toEqual(["2026-09-15", "2026-09-16", "2026-09-17", "2026-09-18", "2026-09-19", "2026-09-20", "2026-09-21"]);
    expect(r.find((b) => b.key === "2026-09-16")).toMatchObject({ total: 100_000, count: 1 });
  });
});
