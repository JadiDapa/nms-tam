import { z } from "zod";

const rupiah = (label: string) =>
  z.number({ error: `${label} is required` }).int().min(0, `${label} cannot be negative`).max(2_000_000_000);

export const CreatePlanSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(60),
  priceMonthly: rupiah("Monthly price"),
  extraSlotPrice: rupiah("Extra slot price"),
  maxDevices: z.number().int().min(1, "At least 1 device").max(100_000),
  maxUsers: z.number().int().min(1, "At least 1 user").max(10_000),
  minPollIntervalSec: z.number().int().min(5).max(86_400),
  sortOrder: z.number().int().default(0),
  isActive: z.boolean().default(true),
});

export const UpdatePlanSchema = CreatePlanSchema.partial();

export type CreatePlanDTO = z.infer<typeof CreatePlanSchema>;
export type UpdatePlanDTO = z.infer<typeof UpdatePlanSchema>;
