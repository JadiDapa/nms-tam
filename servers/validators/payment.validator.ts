import { PaymentKind, PaymentMethod } from "@/generated/prisma";
import { z } from "zod";
import { LIMITS } from "@/lib/config";

export const RecordPaymentSchema = z
  .object({
    orgId: z.number().int().positive(),
    kind: z.enum(PaymentKind),
    planId: z.number().int().positive().optional(),
    months: z.number().int().min(0).max(LIMITS.maxMonthsPerPayment).default(0),
    slots: z.number().int().min(0).max(10_000).default(0),
    amount: z.number({ error: "Amount is required" }).int().min(0, "Amount cannot be negative").max(2_000_000_000),
    method: z.enum(PaymentMethod),
    paidAt: z.coerce.date(),
    reference: z.string().trim().min(1, "Enter a reference (for example the transfer number)").max(200),
    evidenceUrl: z
      .string()
      .trim()
      .max(500)
      .refine((v) => v === "" || /^https?:\/\//i.test(v), "The evidence link must start with http:// or https://")
      .optional(),
    note: z.string().trim().max(500).optional(),
  })
  .superRefine((v, ctx) => {
    const need = (ok: boolean, path: string, message: string) => {
      if (!ok) ctx.addIssue({ code: "custom", path: [path], message });
    };
    if (v.kind === "ACTIVATION") {
      need(v.planId !== undefined, "planId", "Choose a plan");
      need(v.months >= 1, "months", "Enter at least 1 month");
    }
    if (v.kind === "RENEWAL") need(v.months >= 1, "months", "Enter at least 1 month");
    if (v.kind === "EXTRA_SLOTS") need(v.slots >= 1, "slots", "Enter at least 1 slot");
    if (v.kind === "ADJUSTMENT") need(v.months >= 1 || v.slots >= 1, "months", "Add months or slots");
  });

export type RecordPaymentDTO = z.infer<typeof RecordPaymentSchema>;
export type RecordPaymentInput = z.input<typeof RecordPaymentSchema>;

export const VoidPaymentSchema = z.object({
  reason: z.string().trim().min(3, "Enter a reason").max(300),
});
