// Pure billing rules. No database, no clock of its own (the caller passes "now") so they are trivial to test.

export type PricedPlan = {
  name: string;
  priceMonthly: number;
  extraSlotPrice: number;
  maxDevices: number;
  maxUsers: number;
  minPollIntervalSec: number;
};

export type LiveCheck = {
  orgActive: boolean;
  status: "ACTIVE" | "EXPIRED" | "CANCELED";
  currentPeriodEnd: Date;
};

export const deviceLimit = (plan: Pick<PricedPlan, "maxDevices">, extraSlots: number) =>
  plan.maxDevices + extraSlots;

export const monthlyCost = (
  plan: Pick<PricedPlan, "priceMonthly" | "extraSlotPrice">,
  extraSlots: number,
) => plan.priceMonthly + extraSlots * plan.extraSlotPrice;

// A subscription only works while it is ACTIVE, the paid-until date is in the future and the client is not suspended.
export function isLive(sub: LiveCheck | null, now: Date) {
  if (!sub) return false;
  return sub.orgActive && sub.status === "ACTIVE" && sub.currentPeriodEnd.getTime() > now.getTime();
}

// Adds whole months, keeping the day of month where possible (31 Jan + 1 month = 28/29 Feb).
export function addMonths(date: Date, months: number) {
  const d = new Date(date.getTime());
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, lastDay));
  return d;
}

// Paying while still active extends from the current end; paying after expiry restarts from today.
export function periodAfterPayment(currentEnd: Date | null, now: Date, months: number) {
  const from = currentEnd && currentEnd.getTime() > now.getTime() ? currentEnd : now;
  return { from, until: addMonths(from, months) };
}

// Suggested price for adding slots in the middle of a paid period: the remaining part of the period,
// rounded up to the next Rp 1,000. The admin can always type another amount.
export function suggestExtraSlotsAmount(input: {
  slots: number;
  slotPrice: number;
  currentPeriodEnd: Date;
  now: Date;
}) {
  const dayMs = 24 * 60 * 60 * 1000;
  const remainingDays = Math.max(
    0,
    Math.ceil((input.currentPeriodEnd.getTime() - input.now.getTime()) / dayMs),
  );
  const fraction = Math.min(remainingDays, 30) / 30;
  const raw = input.slots * input.slotPrice * fraction;
  return Math.ceil(raw / 1000) * 1000;
}

// What the admin form prefills for an activation / renewal.
export const suggestRenewalAmount = (
  plan: Pick<PricedPlan, "priceMonthly" | "extraSlotPrice">,
  extraSlots: number,
  months: number,
) => monthlyCost(plan, extraSlots) * months;

export function receiptNumber(year: number, sequence: number) {
  return `RCP-${year}-${String(sequence).padStart(4, "0")}`;
}
