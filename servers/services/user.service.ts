import { prisma } from "@/lib/prisma";
import { Prisma, Role } from "@/generated/prisma";
import { CreateUserDTO, UpdateUserDTO } from "../validators/user.validator";

export type UserListOptions = {
  orgId?: number;
  role?: Role;
  search?: string;
};

function userWhere(opts: UserListOptions): Prisma.UserWhereInput {
  const where: Prisma.UserWhereInput = {};

  if (opts.orgId !== undefined) where.orgId = opts.orgId;
  if (opts.role) where.role = opts.role;

  const q = opts.search?.trim();
  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
    ];
  }

  return where;
}

export const UserService = {
  async list(opts: UserListOptions = {}) {
    return await prisma.user.findMany({
      where: userWhere(opts),
      orderBy: { id: "desc" },
      include: { org: true },
    });
  },

  async getById(id: number) {
    return await prisma.user.findUnique({ where: { id } });
  },

  async getByClerkId(clerkId: string) {
    return await prisma.user.findUnique({ where: { clerkId } });
  },

  async getByEmail(email: string) {
    return await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  },

  // Links a pre-provisioned (invited) user to the Clerk account that signed up with the same verified email.
  async linkClerk(email: string, clerkId: string, name?: string | null) {
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user || user.clerkId) return null;
    return await prisma.user.update({
      where: { id: user.id },
      data: { clerkId, name: user.name ?? name ?? null },
    });
  },

  async countByOrg(orgId: number) {
    return await prisma.user.count({ where: { orgId, active: true } });
  },

  async create(data: CreateUserDTO) {
    return await prisma.user.create({
      data: { ...data, email: data.email.toLowerCase() },
    });
  },

  async update(id: number, data: UpdateUserDTO) {
    return await prisma.user.update({ where: { id }, data });
  },

  async delete(id: number) {
    return await prisma.user.delete({ where: { id } });
  },
};
