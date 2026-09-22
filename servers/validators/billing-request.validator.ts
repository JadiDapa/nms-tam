import { RequestKind } from "@/generated/prisma";
import { z } from "zod";

export const CreateBillingRequestSchema = z
  .object({
    kind: z.enum(RequestKind),
    planId: z.number().int().positive().optional(),
    slots: z.number().int().min(1, "Enter at least 1 slot").max(1000).optional(),
    message: z.string().trim().max(500).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.kind === "PLAN_CHANGE" && !v.planId) {
      ctx.addIssue({ code: "custom", path: ["planId"], message: "Choose a plan" });
    }
    if (v.kind === "EXTRA_SLOTS" && !v.slots) {
      ctx.addIssue({ code: "custom", path: ["slots"], message: "Enter how many slots you need" });
    }
  });

export const ResolveBillingRequestSchema = z.object({
  status: z.enum(["DONE", "REJECTED"]),
  adminNote: z.string().trim().max(500).optional(),
});

export type CreateBillingRequestDTO = z.infer<typeof CreateBillingRequestSchema>;
