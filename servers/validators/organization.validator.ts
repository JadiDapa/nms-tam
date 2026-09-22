import { OrgStatus } from "@/generated/prisma";
import { z } from "zod";

export const CreateOrganizationSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(120),
  note: z.string().max(500).nullish(),
});

export const UpdateOrganizationSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  note: z.string().max(500).nullish(),
  status: z.enum(OrgStatus).optional(),
});

export type CreateOrganizationDTO = z.infer<typeof CreateOrganizationSchema>;
export type UpdateOrganizationDTO = z.infer<typeof UpdateOrganizationSchema>;
