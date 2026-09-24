import { z } from "zod";

export const SimulateSchema = z
  .object({
    scope: z.enum(["all", "selected"]),
    deviceIds: z.array(z.number().int()).default([]),
    startAt: z.date(),
    durationValue: z.number().int().min(1).max(100_000),
    durationUnit: z.enum(["seconds", "minutes", "hours"]),
    targetAlertCount: z.number().int().min(0).max(10_000).default(0),
  })
  .superRefine((v, ctx) => {
    if (v.scope === "selected" && v.deviceIds.length === 0) {
      ctx.addIssue({ code: "custom", path: ["deviceIds"], message: "Pick at least one device" });
    }
  });

export type SimulateInput = z.infer<typeof SimulateSchema>;
