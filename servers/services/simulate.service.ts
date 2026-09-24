import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import { engine } from "../engine/engine-client";
import { call } from "../engine/engine-call";
import type { SimulateInput } from "../validators/simulate.validator";

// Admin-only: unlike the rest of this codebase, this deliberately reads devices across ALL organizations, not one
// org's mirror rows. The org-isolation rules elsewhere exist to keep clients apart from each other; this feature is
// a platform-admin tool where devices are picked directly, not scoped by org.
export const SimulateService = {
  async listAllDevices() {
    const [mirrors, engineDevices] = await Promise.all([
      prisma.device.findMany({
        where: { engineDeviceId: { not: null } },
        select: { id: true, name: true, engineDeviceId: true, org: { select: { name: true } } },
        orderBy: { name: "asc" },
      }),
      call(null, () => engine.listDevices()),
    ]);
    const byEngineId = new Map(engineDevices.items.map((d) => [d.id, d]));
    return mirrors.flatMap((m) => {
      const e = m.engineDeviceId ? byEngineId.get(m.engineDeviceId) : undefined;
      if (!e) return [];
      return [{ id: m.id, name: m.name, orgName: m.org.name, pollIntervalSec: e.polling.pollIntervalSec }];
    });
  },

  async run(input: SimulateInput) {
    let deviceIds: "all" | string[] = "all";
    if (input.scope === "selected") {
      const rows = await prisma.device.findMany({
        where: { id: { in: input.deviceIds }, engineDeviceId: { not: null } },
        select: { engineDeviceId: true },
      });
      deviceIds = rows.map((r) => r.engineDeviceId!);
      if (deviceIds.length === 0) throw new AppError("No valid devices selected");
    }

    return call(null, () =>
      engine.simulate({
        deviceIds,
        startAt: input.startAt.toISOString(),
        durationValue: input.durationValue,
        durationUnit: input.durationUnit,
        targetAlertCount: input.targetAlertCount,
      }),
    );
  },
};
