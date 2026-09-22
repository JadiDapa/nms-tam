import { prisma } from "@/lib/prisma";
import { DeviceStatus, DisabledBy } from "@/generated/prisma";
import { AppError } from "@/lib/errors";

// The ownership mirror of engine devices. A row here = one slot of the client's quota.
export const DeviceService = {
  async listByOrg(orgId: number) {
    return await prisma.device.findMany({ where: { orgId }, orderBy: { name: "asc" } });
  },

  async getOwned(orgId: number, id: number) {
    const device = await prisma.device.findFirst({ where: { id, orgId } });
    if (!device) throw new AppError("Device not found", 404);
    return device;
  },

  async getByEngineId(orgId: number, engineDeviceId: string) {
    return await prisma.device.findFirst({ where: { orgId, engineDeviceId } });
  },

  async count(orgId: number) {
    return await prisma.device.count({ where: { orgId } });
  },

  // Takes a slot. The client's row is locked while counting, so two simultaneous adds cannot both take the last slot.
  async reserve(input: { orgId: number; name: string; createdById: number; limit: number }) {
    return await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Organization" WHERE id = ${input.orgId} FOR UPDATE`;
      const used = await tx.device.count({ where: { orgId: input.orgId } });
      if (used >= input.limit) {
        throw new AppError(
          `Device quota reached (${used} of ${input.limit}). Request more slots to add another device.`,
        );
      }
      return await tx.device.create({
        data: { orgId: input.orgId, name: input.name, createdById: input.createdById, status: "PENDING" },
      });
    });
  },

  async confirm(id: number, engineDeviceId: string, enabled: boolean) {
    return await prisma.device.update({
      where: { id },
      data: { engineDeviceId, status: enabled ? "ACTIVE" : "SUSPENDED", disabledBy: enabled ? null : "USER" },
    });
  },

  async release(id: number) {
    await prisma.device.delete({ where: { id } }).catch(() => undefined);
  },

  async setCoordinates(id: number, latitude: number | null, longitude: number | null) {
    return await prisma.device.update({ where: { id }, data: { latitude, longitude } });
  },

  async setName(id: number, name: string) {
    return await prisma.device.update({ where: { id }, data: { name } });
  },

  async setStatus(id: number, status: DeviceStatus, disabledBy: DisabledBy | null) {
    return await prisma.device.update({ where: { id }, data: { status, disabledBy } });
  },

  // Reservations that never completed (the process died between "take a slot" and "engine created it").
  async purgeStalePending(olderThanMinutes = 10) {
    const cutoff = new Date(Date.now() - olderThanMinutes * 60_000);
    const r = await prisma.device.deleteMany({
      where: { status: "PENDING", engineDeviceId: null, createdAt: { lt: cutoff } },
    });
    return r.count;
  },
};
