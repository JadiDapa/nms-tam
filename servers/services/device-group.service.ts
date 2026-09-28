import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";

// User-defined device buckets ("Area A", ...). App-side only, never touches the engine.
export const DeviceGroupService = {
  async listByOrg(orgId: number) {
    const groups = await prisma.deviceGroup.findMany({
      where: { orgId },
      orderBy: { name: "asc" },
      include: { _count: { select: { devices: true } } },
    });
    return groups.map((g) => ({ id: g.id, name: g.name, deviceCount: g._count.devices }));
  },

  async create(orgId: number, name: string) {
    const clean = name.trim();
    const existing = await prisma.deviceGroup.findFirst({ where: { orgId, name: { equals: clean, mode: "insensitive" } } });
    if (existing) throw new AppError("A group with this name already exists");
    return await prisma.deviceGroup.create({ data: { orgId, name: clean } });
  },

  async rename(orgId: number, id: number, name: string) {
    const clean = name.trim();
    const group = await prisma.deviceGroup.findFirst({ where: { id, orgId } });
    if (!group) throw new AppError("Group not found", 404);
    const existing = await prisma.deviceGroup.findFirst({ where: { orgId, name: { equals: clean, mode: "insensitive" }, id: { not: id } } });
    if (existing) throw new AppError("A group with this name already exists");
    return await prisma.deviceGroup.update({ where: { id }, data: { name: clean } });
  },

  async remove(orgId: number, id: number) {
    const group = await prisma.deviceGroup.findFirst({ where: { id, orgId }, include: { _count: { select: { devices: true } } } });
    if (!group) throw new AppError("Group not found", 404);
    if (group._count.devices > 0) {
      throw new AppError("Move or remove the devices in this group before deleting it");
    }
    await prisma.deviceGroup.delete({ where: { id } });
  },

  // Validates a group belongs to the org before it is attached to a device (mirrors credential ownership checks).
  async assertOwned(orgId: number, id: number) {
    const group = await prisma.deviceGroup.findFirst({ where: { id, orgId } });
    if (!group) throw new AppError("Group not found", 404);
    return group;
  },
};
