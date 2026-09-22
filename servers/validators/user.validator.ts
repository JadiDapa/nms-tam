import { Role } from "@/generated/prisma";
import { z } from "zod";

const UserBaseSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  email: z.string().email("Enter a valid email address"),
  role: z.enum(Role),
  orgId: z.number().int().positive().nullable(),
});

// A client user must belong to an organization; an admin (our staff) belongs to none.
export const CreateUserSchema = UserBaseSchema.refine(
  (u) => (u.role === "USER" ? u.orgId !== null : u.orgId === null),
  { message: "A client user needs an organization; an admin has none", path: ["orgId"] },
);

export const UpdateUserSchema = z.object({
  name: z.string().min(1, "Name is required").max(100).optional(),
  active: z.boolean().optional(),
});

export type CreateUserDTO = z.infer<typeof CreateUserSchema>;
export type UpdateUserDTO = z.infer<typeof UpdateUserSchema>;
