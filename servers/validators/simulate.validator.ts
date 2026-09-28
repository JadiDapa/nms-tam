import { z } from "zod";

const timeOfDaySec = z.number().int().min(0).max(86_400);

const WindowSchema = z
  .object({
    weekdays: z.array(z.number().int().min(0).max(6)).min(1).max(7),
    dailyStartSec: timeOfDaySec,
    dailyEndSec: timeOfDaySec,
    trafficMinBps: z.number().finite().min(0),
    trafficMaxBps: z.number().finite().min(0),
  })
  .superRefine((v, ctx) => {
    if (v.dailyEndSec <= v.dailyStartSec) {
      ctx.addIssue({ code: "custom", path: ["dailyEndSec"], message: "Daily end time must be after daily start time" });
    }
    if (v.trafficMaxBps <= v.trafficMinBps) {
      ctx.addIssue({ code: "custom", path: ["trafficMaxBps"], message: "Traffic max must be greater than traffic min" });
    }
  });

export const SimulateSchema = z
  .object({
    accountId: z.number().int(),
    scope: z.enum(["all", "selected"]),
    deviceIds: z.array(z.number().int()).default([]),
    startDate: z.date(),
    endDate: z.date(),
    // Checked in order; the first window whose weekday + time-of-day covers a tick wins.
    windows: z.array(WindowSchema).max(20).default([]),
    // Applies to any tick no window matches.
    defaultTrafficMinBps: z.number().finite().min(0),
    defaultTrafficMaxBps: z.number().finite().min(0),
  })
  .superRefine((v, ctx) => {
    if (v.scope === "selected" && v.deviceIds.length === 0) {
      ctx.addIssue({ code: "custom", path: ["deviceIds"], message: "Pick at least one device" });
    }
    if (v.endDate.getTime() < v.startDate.getTime()) {
      ctx.addIssue({ code: "custom", path: ["endDate"], message: "End date must be on or after the start date" });
    }
    if (v.defaultTrafficMaxBps <= v.defaultTrafficMinBps) {
      ctx.addIssue({ code: "custom", path: ["defaultTrafficMaxBps"], message: "Default traffic max must be greater than default traffic min" });
    }
  });

export type SimulateInput = z.infer<typeof SimulateSchema>;
