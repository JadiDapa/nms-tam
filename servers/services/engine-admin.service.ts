import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import { engine } from "../engine/engine-client";
import { call } from "../engine/engine-call";
import { AuditService } from "./audit.service";

export type OrphanKind = "device" | "credential" | "channel" | "rule";

// Things that exist in the engine but that no client owns (left behind by a crash, or created by hand).
// They cost nothing to clients but should be visible to an admin.
export const EngineAdminService = {
  async health() {
    try {
      return { ok: true as const, health: await engine.health() };
    } catch {
      return { ok: false as const, health: null };
    }
  },

  async orphans() {
    const [devices, credentials, channels, rules, mirrors] = await Promise.all([
      call(null, () => engine.listDevices()),
      call(null, () => engine.listCredentials(undefined)),
      call(null, () => engine.listChannels(undefined)),
      call(null, () => engine.listRules(undefined)),
      prisma.engineResource.findMany({ select: { engineId: true } }),
    ]);
    const owned = new Set(mirrors.map((m) => m.engineId));
    const ownedDevices = new Set(
      (await prisma.device.findMany({ where: { engineDeviceId: { not: null } }, select: { engineDeviceId: true } })).map((d) => d.engineDeviceId!),
    );
    return {
      devices: devices.items.filter((d) => !ownedDevices.has(d.id)).map((d) => ({ id: d.id, name: d.name, detail: d.host })),
      credentials: credentials.items.filter((c) => !owned.has(c.id)).map((c) => ({ id: c.id, name: c.name, detail: c.type })),
      channels: channels.items.filter((c) => !owned.has(c.id)).map((c) => ({ id: c.id, name: c.name, detail: c.type })),
      rules: rules.items.filter((r) => !owned.has(r.id)).map((r) => ({ id: r.id, name: r.name, detail: r.conditionType })),
    };
  },

  async deleteOrphan(actorId: number, kind: OrphanKind, engineId: string) {
    const claimed =
      kind === "device"
        ? await prisma.device.count({ where: { engineDeviceId: engineId } })
        : await prisma.engineResource.count({ where: { engineId } });
    if (claimed > 0) throw new AppError("This object belongs to a client and cannot be removed here.");

    if (kind === "device") await call(null, () => engine.deleteDevice(engineId));
    else if (kind === "rule") await call(null, () => engine.deleteRule(engineId));
    else if (kind === "channel") await call(null, () => engine.deleteChannel(engineId));
    else await call(null, () => engine.deleteCredential(engineId));
    await AuditService.log({ actorId, action: "engine.orphan.delete", targetType: kind, targetId: engineId });
  },
};
