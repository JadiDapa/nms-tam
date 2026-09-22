import { describe, expect, it } from "vitest";
import {
  addMonths,
  deviceLimit,
  isLive,
  monthlyCost,
  periodAfterPayment,
  receiptNumber,
  suggestExtraSlotsAmount,
  suggestRenewalAmount,
} from "./pricing";

const d = (s: string) => new Date(s);
const starter = { priceMonthly: 250_000, extraSlotPrice: 10_000 };

describe("plan limits and cost", () => {
  it("device limit = plan slots + bought slots", () => {
    expect(deviceLimit({ maxDevices: 25 }, 4)).toBe(29);
    expect(deviceLimit({ maxDevices: 25 }, 0)).toBe(25);
  });

  it("monthly cost adds the extra slots at the plan's slot price", () => {
    expect(monthlyCost(starter, 0)).toBe(250_000);
    expect(monthlyCost(starter, 4)).toBe(290_000);
    expect(suggestRenewalAmount(starter, 4, 3)).toBe(870_000);
  });
});

describe("isLive", () => {
  const future = d("2026-12-01T00:00:00Z");
  const now = d("2026-10-01T00:00:00Z");

  it("needs an ACTIVE subscription that is paid past now, for an active client", () => {
    expect(isLive({ orgActive: true, status: "ACTIVE", currentPeriodEnd: future }, now)).toBe(true);
    expect(isLive(null, now)).toBe(false);
    expect(isLive({ orgActive: false, status: "ACTIVE", currentPeriodEnd: future }, now)).toBe(false);
    expect(isLive({ orgActive: true, status: "EXPIRED", currentPeriodEnd: future }, now)).toBe(false);
    expect(isLive({ orgActive: true, status: "CANCELED", currentPeriodEnd: future }, now)).toBe(false);
  });

  it("stops the instant the paid-until date passes, even before the worker marks it EXPIRED (no grace)", () => {
    const sub = { orgActive: true, status: "ACTIVE" as const, currentPeriodEnd: now };
    expect(isLive(sub, now)).toBe(false);
    expect(isLive(sub, d("2026-09-30T23:59:59Z"))).toBe(true);
  });
});

describe("addMonths", () => {
  it("keeps the day of month", () => {
    expect(addMonths(d("2026-01-15T10:00:00Z"), 1).toISOString()).toBe("2026-02-15T10:00:00.000Z");
    expect(addMonths(d("2026-11-30T00:00:00Z"), 3).toISOString()).toBe("2027-02-28T00:00:00.000Z");
  });

  it("clamps to the last day of a shorter month", () => {
    expect(addMonths(d("2026-01-31T00:00:00Z"), 1).toISOString()).toBe("2026-02-28T00:00:00.000Z");
    expect(addMonths(d("2028-01-31T00:00:00Z"), 1).toISOString()).toBe("2028-02-29T00:00:00.000Z");
  });

  it("rolls over the year", () => {
    expect(addMonths(d("2026-12-10T00:00:00Z"), 2).toISOString()).toBe("2027-02-10T00:00:00.000Z");
    expect(addMonths(d("2026-06-10T00:00:00Z"), 12).toISOString()).toBe("2027-06-10T00:00:00.000Z");
  });
});

describe("periodAfterPayment", () => {
  const now = d("2026-10-10T00:00:00Z");

  it("extends from the current end while the subscription is still running", () => {
    const r = periodAfterPayment(d("2026-10-20T00:00:00Z"), now, 1);
    expect(r.from.toISOString()).toBe("2026-10-20T00:00:00.000Z");
    expect(r.until.toISOString()).toBe("2026-11-20T00:00:00.000Z");
  });

  it("restarts from today after it expired (no back-billing of the gap)", () => {
    const r = periodAfterPayment(d("2026-09-01T00:00:00Z"), now, 2);
    expect(r.from.toISOString()).toBe(now.toISOString());
    expect(r.until.toISOString()).toBe("2026-12-10T00:00:00.000Z");
  });

  it("starts from today when there is no subscription yet", () => {
    expect(periodAfterPayment(null, now, 1).until.toISOString()).toBe("2026-11-10T00:00:00.000Z");
  });
});

describe("suggestExtraSlotsAmount", () => {
  const now = d("2026-10-01T00:00:00Z");

  it("charges the full month when 30 or more days remain", () => {
    expect(suggestExtraSlotsAmount({ slots: 4, slotPrice: 10_000, currentPeriodEnd: d("2026-11-15T00:00:00Z"), now })).toBe(40_000);
  });

  it("prorates by the remaining days and rounds up to Rp 1,000", () => {
    // 15 of 30 days remain -> 4 x 10,000 x 0.5 = 20,000
    expect(suggestExtraSlotsAmount({ slots: 4, slotPrice: 10_000, currentPeriodEnd: d("2026-10-16T00:00:00Z"), now })).toBe(20_000);
    // 10 of 30 days -> 3 x 10,000 x 1/3 = 10,000 ; 7 days -> 1 x 10,000 x 7/30 = 2,333 -> 3,000
    expect(suggestExtraSlotsAmount({ slots: 1, slotPrice: 10_000, currentPeriodEnd: d("2026-10-08T00:00:00Z"), now })).toBe(3_000);
  });

  it("is zero when the period is already over", () => {
    expect(suggestExtraSlotsAmount({ slots: 4, slotPrice: 10_000, currentPeriodEnd: d("2026-09-01T00:00:00Z"), now })).toBe(0);
  });
});

describe("receiptNumber", () => {
  it("is zero padded per year", () => {
    expect(receiptNumber(2026, 1)).toBe("RCP-2026-0001");
    expect(receiptNumber(2026, 123)).toBe("RCP-2026-0123");
    expect(receiptNumber(2027, 12345)).toBe("RCP-2027-12345");
  });
});
