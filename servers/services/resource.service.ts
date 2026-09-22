import { prisma } from "@/lib/prisma";
import { ResourceKind } from "@/generated/prisma";
import { AppError } from "@/lib/errors";

// The ownership mirror of engine credentials, channels and alert rules.
export const ResourceService = {
  async listByOrg(orgId: number, kind: ResourceKind) {
    return await prisma.engineResource.findMany({ where: { orgId, kind }, orderBy: { label: "asc" } });
  },

  async count(orgId: number, kind: ResourceKind) {
    return await prisma.engineResource.count({ where: { orgId, kind } });
  },

  async getOwned(orgId: number, kind: ResourceKind, id: number) {
    const r = await prisma.engineResource.findFirst({ where: { id, orgId, kind } });
    if (!r) throw new AppError("Not found", 404);
    return r;
  },

  // Looks up by the engine id, still scoped to the client (used when a form submits ids of related objects).
  async getOwnedByEngineId(orgId: number, kind: ResourceKind, engineId: string) {
    const r = await prisma.engineResource.findFirst({ where: { orgId, kind, engineId } });
    if (!r) throw new AppError("Not found", 404);
    return r;
  },

  async add(orgId: number, kind: ResourceKind, engineId: string, label: string) {
    return await prisma.engineResource.create({ data: { orgId, kind, engineId, label } });
  },

  async setLabel(id: number, label: string) {
    return await prisma.engineResource.update({ where: { id }, data: { label } });
  },

  async remove(id: number) {
    await prisma.engineResource.delete({ where: { id } }).catch(() => undefined);
  },

  async removeByEngineIds(engineIds: string[]) {
    if (engineIds.length === 0) return;
    await prisma.engineResource.deleteMany({ where: { engineId: { in: engineIds } } });
  },
};
