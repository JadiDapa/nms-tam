import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import { engine } from "../engine/engine-client";
import { call } from "../engine/engine-call";
import type { SimulateInput } from "../validators/simulate.validator";

// Admin-only: "account" here is the platform USER who owns devices (Device.createdById), not an organization.
export const SimulateService = {
  async listAccountsWithDevices() {
    const [users, engineDevices] = await Promise.all([
      prisma.user.findMany({
        where: { devices: { some: { engineDeviceId: { not: null } } } },
        select: {
          id: true,
          name: true,
          email: true,
          devices: {
            where: { engineDeviceId: { not: null } },
            select: { id: true, name: true, engineDeviceId: true, group: { select: { name: true } } },
            orderBy: [{ group: { name: "asc" } }, { name: "asc" }],
          },
        },
        orderBy: { name: "asc" },
      }),
      call(null, () => engine.listDevices()),
    ]);
    const byEngineId = new Map(engineDevices.items.map((d) => [d.id, d]));

    return users.map((u) => ({
      id: u.id,
      label: u.name ?? u.email,
      devices: u.devices.flatMap((d) => {
        const e = d.engineDeviceId ? byEngineId.get(d.engineDeviceId) : undefined;
        if (!e) return [];
        return [{ id: d.id, name: d.name, groupName: d.group?.name ?? null, pollIntervalSec: e.polling.pollIntervalSec }];
      }),
    }));
  },

  async run(input: SimulateInput) {
    const where = input.scope === "all" ? { createdById: input.accountId } : { id: { in: input.deviceIds }, createdById: input.accountId };
    const rows = await prisma.device.findMany({ where: { ...where, engineDeviceId: { not: null } }, select: { engineDeviceId: true } });
    const deviceIds = rows.map((r) => r.engineDeviceId!);
    if (deviceIds.length === 0) throw new AppError("No valid devices selected for this account");

    // endDate is a calendar day, inclusive: push it to the start of the next day so a single-day range
    // (startDate === endDate) still covers that whole day instead of collapsing to a zero-length window.
    const endAt = new Date(input.endDate.getTime() + 86_400_000);

    return call(null, () =>
      engine.simulate({
        deviceIds,
        startAt: input.startDate.toISOString(),
        endAt: endAt.toISOString(),
        windows: input.windows,
        defaultTrafficMinBps: input.defaultTrafficMinBps,
        defaultTrafficMaxBps: input.defaultTrafficMaxBps,
      }),
    );
  },

  async status(jobId: string) {
    return call(null, () => engine.simulateStatus(jobId));
  },
};
