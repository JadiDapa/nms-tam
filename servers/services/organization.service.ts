import { prisma } from "@/lib/prisma";
import {
  CreateOrganizationDTO,
  UpdateOrganizationDTO,
} from "../validators/organization.validator";

export const OrganizationService = {
  // The admin list: every client with its plan and how much of the device quota is used.
  async list() {
    return await prisma.organization.findMany({
      orderBy: { id: "desc" },
      include: {
        subscription: { include: { plan: true } },
        _count: { select: { devices: true, users: true } },
      },
    });
  },

  async getById(id: number) {
    return await prisma.organization.findUnique({
      where: { id },
      include: {
        subscription: { include: { plan: true } },
        _count: { select: { devices: true, users: true } },
      },
    });
  },

  async create(data: CreateOrganizationDTO) {
    return await prisma.organization.create({ data });
  },

  async update(id: number, data: UpdateOrganizationDTO) {
    return await prisma.organization.update({ where: { id }, data });
  },
};
