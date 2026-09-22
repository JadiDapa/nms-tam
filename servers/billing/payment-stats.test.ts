import { describe, expect, it } from "vitest";
import { paymentsByMonth } from "./payment-stats";

describe("paymentsByMonth", () => {
  const now = new Date(2026, 8, 21); // 21 Sep 2026
  const pay = (y: number, m: number, d: number, amount: number, voided = false) => ({
    paidAt: new Date(y, m, d),
    amount,
    voidedAt: voided ? new Date(y, m, d + 1) : null,
  });

  it("lists every month of the window, oldest first, even without payments", () => {
    const r = paymentsByMonth([], 3, now);
    expect(r.map((b) => b.key)).toEqual(["2026-07", "2026-08", "2026-09"]);
    expect(r.every((b) => b.total === 0 && b.count === 0)).toBe(true);
  });

  it("adds up the payments of a month and counts them", () => {
    const r = paymentsByMonth([pay(2026, 8, 1, 300_000), pay(2026, 8, 20, 50_000), pay(2026, 7, 5, 300_000)], 3, now);
    expect(r.find((b) => b.key === "2026-09")).toMatchObject({ total: 350_000, count: 2 });
    expect(r.find((b) => b.key === "2026-08")).toMatchObject({ total: 300_000, count: 1 });
    expect(r.find((b) => b.key === "2026-07")).toMatchObject({ total: 0, count: 0 });
  });

  it("ignores voided payments and payments outside the window", () => {
    const r = paymentsByMonth([pay(2026, 8, 2, 999_000, true), pay(2026, 3, 2, 123_000), pay(2026, 8, 3, 10_000)], 3, now);
    expect(r.reduce((s, b) => s + b.total, 0)).toBe(10_000);
  });

  it("crosses a year boundary", () => {
    const r = paymentsByMonth([pay(2025, 11, 15, 1)], 3, new Date(2026, 0, 10));
    expect(r.map((b) => b.key)).toEqual(["2025-11", "2025-12", "2026-01"]);
    expect(r[1].total).toBe(1);
  });
});
