import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import { ttlMemo } from "@/lib/ttl-memo";
import { engine } from "../engine/engine-client";
import { call } from "../engine/engine-call";
import type { EngineFleetItem, InterfaceBucket, MetricBucket } from "../engine/engine-types";
import { assertTargetAllowed } from "../monitoring/target-policy";
import {
  CreateDeviceSchema,
  RANGES,
  TestDeviceSchema,
  UpdateDeviceSchema,
  type CreateDeviceInput,
  type RangeKey,
  type TestDeviceInput,
  type UpdateDeviceInput,
} from "../validators/monitoring.validator";
import { AuditService } from "./audit.service";
import { DeviceService } from "./device.service";
import { ResourceService } from "./resource.service";
import { SubscriptionService } from "./subscription.service";

async function requireLive(orgId: number) {
  const ent = await SubscriptionService.getEntitlements(orgId);
  if (!ent.live) throw new AppError(ent.reason ?? "Your subscription is not active.");
  return ent;
}

// Poll intervals faster than the plan allows are refused, so nobody can ask for 5 s polling on 100 devices.
function checkInterval(pollIntervalSec: number | undefined, min: number) {
  if (pollIntervalSec !== undefined && pollIntervalSec < min) {
    throw new AppError(`Your plan allows a poll interval of at least ${min} seconds.`);
  }
}

// Translates the client's own credential id (our record) into the engine's id, proving the client owns it.
async function engineCredentialId(orgId: number, credentialId: number | null | undefined) {
  if (!credentialId) return null;
  const c = await ResourceService.getOwned(orgId, "CREDENTIAL", credentialId);
  return c.engineId;
}

// Only physical links are summed: bridges, VLANs, bonds and PPP sessions carry traffic that is already counted on the ports below them.
const PHYSICAL_IF_TYPES = new Set(["ethernetCsmacd", "gigabitEthernet", "fastEther", "fastEtherFX", "ieee80211"]);

export type DeviceExtra = {
  deviceType: string;
  vendor: string | null;
  model: string | null;
  icmp: boolean;
  snmp: boolean;
  tcpPorts: number;
  // current in + out over the device's monitored physical interfaces
  throughputBps: number | null;
  // average ping latency per 5-minute slot over the last hour (null = no reading)
  latencySeries: (number | null)[];
};

// The last hour in 5-minute slots. By default the last slot is the one containing "now"; with `completeOnly` it is the
// last finished slot (needed for sums: a slot that just began has readings from only some interfaces and would undercount).
function slotWindow(completeOnly = false) {
  const SLOT = 300_000;
  const SLOTS = 12;
  const end = Math.floor(Date.now() / SLOT) * SLOT - (completeOnly ? SLOT : 0);
  return { SLOT, SLOTS, start: end - (SLOTS - 1) * SLOT };
}

export const DeviceMonitorService = {
  // ---- add / change ------------------------------------------------------------------------------------------------

  // Stateless "does this really work?" check. Nothing is saved and it does not use a slot.
  async test(orgId: number, raw: TestDeviceInput) {
    await requireLive(orgId);
    const input = TestDeviceSchema.parse(raw);
    await assertTargetAllowed(input.host);
    const credentialId = await engineCredentialId(orgId, input.snmpCredentialId);
    return await call(orgId, () =>
      engine.testDevice({
        host: input.host,
        icmp: input.icmp,
        tcpPorts: input.tcpPorts,
        ...(credentialId ? { snmp: { credentialId, port: input.snmpPort } } : {}),
        timeoutMs: 3000,
        retries: 1,
      }),
    );
  },

  async create(actor: { id: number }, orgId: number, raw: CreateDeviceInput) {
    const input = CreateDeviceSchema.parse(raw);
    const ent = await requireLive(orgId);
    checkInterval(input.polling.pollIntervalSec, ent.minPollIntervalSec);
    await assertTargetAllowed(input.host);
    const credentialId = await engineCredentialId(orgId, input.snmpCredentialId);

    // 1) take a slot (fails when the quota is used up)  2) create in the engine  3) confirm, or give the slot back
    const slot = await DeviceService.reserve({ orgId, name: input.name, createdById: actor.id, limit: ent.deviceLimit });
    let engineId: string | null = null;
    try {
      const created = await call(orgId, () =>
        engine.createDevice({
          name: input.name,
          host: input.host,
          deviceType: input.deviceType,
          location: input.location ?? null,
          enabled: input.enabled,
          icmpEnabled: input.icmpEnabled,
          tcpPorts: input.tcpPorts,
          snmpEnabled: input.snmpEnabled,
          snmpCredentialId: input.snmpEnabled ? credentialId : null,
          snmpPort: input.snmpPort,
          polling: { ...input.polling, pollIntervalSec: input.polling.pollIntervalSec ?? Math.max(30, ent.minPollIntervalSec) },
        }),
      );
      engineId = created.id;
      await DeviceService.confirm(slot.id, created.id, input.enabled);
      if (input.latitude != null && input.longitude != null) await DeviceService.setCoordinates(slot.id, input.latitude, input.longitude);
    } catch (err) {
      if (engineId) await engine.deleteDevice(engineId).catch(() => undefined);
      await DeviceService.release(slot.id);
      throw err;
    }
    await AuditService.log({ actorId: actor.id, orgId, action: "device.create", targetType: "Device", targetId: slot.id, metadata: { name: input.name, host: input.host } });
    return slot.id;
  },

  async update(actor: { id: number }, orgId: number, id: number, raw: UpdateDeviceInput) {
    const input = UpdateDeviceSchema.parse(raw);
    const ent = await requireLive(orgId);
    const device = await DeviceService.getOwned(orgId, id);
    checkInterval(input.polling?.pollIntervalSec, ent.minPollIntervalSec);
    if (input.host) await assertTargetAllowed(input.host);

    const patch: Record<string, unknown> = { ...input };
    delete patch.snmpCredentialId;
    // the map position lives in our own table; the engine does not know it
    delete patch.latitude;
    delete patch.longitude;
    if (input.snmpCredentialId !== undefined || input.snmpEnabled === false) {
      patch.snmpCredentialId = input.snmpEnabled === false ? null : await engineCredentialId(orgId, input.snmpCredentialId);
    }
    if (!device.engineDeviceId) throw new AppError("This device is still being created.");
    if (Object.keys(patch).length > 0) await call(orgId, () => engine.updateDevice(device.engineDeviceId!, patch));
    if (input.latitude !== undefined || input.longitude !== undefined) {
      await DeviceService.setCoordinates(id, input.latitude ?? null, input.longitude ?? null);
    }
    if (input.name && input.name !== device.name) await DeviceService.setName(id, input.name);
    await AuditService.log({ actorId: actor.id, orgId, action: "device.update", targetType: "Device", targetId: id });
  },

  // Removing a device frees its slot. Allowed even when the subscription has expired.
  async remove(actor: { id: number }, orgId: number, id: number) {
    const device = await DeviceService.getOwned(orgId, id);
    if (device.engineDeviceId) {
      const engineId = device.engineDeviceId;
      // alert rules of this device disappear with it in the engine; forget their records too
      const ruleRecords = await prisma.engineResource.findMany({ where: { orgId, kind: "ALERT_RULE" } });
      const rules = await call(orgId, () => engine.listRules(ruleRecords.map((r) => r.engineId)));
      const gone = rules.items.filter((r) => r.deviceId === engineId).map((r) => r.id);
      await call(orgId, () => engine.deleteDevice(engineId)).catch((err) => {
        if (err instanceof AppError && err.status === 404) return;
        throw err;
      });
      await ResourceService.removeByEngineIds(gone);
    }
    await DeviceService.release(id);
    await AuditService.log({ actorId: actor.id, orgId, action: "device.delete", targetType: "Device", targetId: id, metadata: { name: device.name } });
  },

  // The client pauses or resumes polling of one device (the slot stays used either way).
  async setEnabled(actor: { id: number }, orgId: number, id: number, enabled: boolean) {
    if (enabled) await requireLive(orgId);
    const device = await DeviceService.getOwned(orgId, id);
    if (!device.engineDeviceId) throw new AppError("This device is still being created.");
    await call(orgId, () => engine.updateDevice(device.engineDeviceId!, { enabled }));
    await DeviceService.setStatus(id, enabled ? "ACTIVE" : "SUSPENDED", enabled ? null : "USER");
    await AuditService.log({ actorId: actor.id, orgId, action: enabled ? "device.resume" : "device.pause", targetType: "Device", targetId: id });
  },

  async pollNow(orgId: number, id: number) {
    await requireLive(orgId);
    const device = await DeviceService.getOwned(orgId, id);
    if (!device.engineDeviceId) throw new AppError("This device is still being created.");
    return await call(orgId, () => engine.pollDevice(device.engineDeviceId!));
  },

  async testStored(orgId: number, id: number) {
    await requireLive(orgId);
    const device = await DeviceService.getOwned(orgId, id);
    if (!device.engineDeviceId) throw new AppError("This device is still being created.");
    return await call(orgId, () => engine.testStoredDevice(device.engineDeviceId!));
  },

  // ---- subscription enforcement ------------------------------------------------------------------------------------
  // Pauses a client's devices when the subscription is not live and resumes the ones WE paused when it is live again.
  // Devices the client paused themselves stay paused. Safe to run any number of times (the worker does).
  async syncOrgDevices(orgId: number) {
    const ent = await SubscriptionService.getEntitlements(orgId);
    const devices = await prisma.device.findMany({ where: { orgId, engineDeviceId: { not: null } } });
    let changed = 0;
    let failed = 0;

    for (const d of devices) {
      const shouldPause = !ent.live && d.status === "ACTIVE";
      const shouldResume = ent.live && d.status === "SUSPENDED" && d.disabledBy === "SUBSCRIPTION";
      if (!shouldPause && !shouldResume) continue;
      try {
        await engine.updateDevice(d.engineDeviceId!, { enabled: shouldResume });
        await DeviceService.setStatus(d.id, shouldResume ? "ACTIVE" : "SUSPENDED", shouldResume ? null : "SUBSCRIPTION");
        changed++;
      } catch (err) {
        failed++;
        console.error(`sync device ${d.id} failed`, err);
      }
    }
    return { changed, failed };
  },

  // ---- read side ---------------------------------------------------------------------------------------------------

  async fleet(orgId: number) {
    const devices = await DeviceService.listByOrg(orgId);
    const ids = devices.map((d) => d.engineDeviceId).filter((x): x is string => x !== null);
    let items: EngineFleetItem[] = [];
    let engineOk = true;
    try {
      items = (await engine.fleet(ids)).items;
    } catch {
      engineOk = false;
    }
    const byId = new Map(items.map((i) => [i.deviceId, i]));
    return {
      engineOk,
      rows: devices.map((device) => ({ device, fleet: device.engineDeviceId ? (byId.get(device.engineDeviceId) ?? null) : null })),
    };
  },

  // Average ping latency per 5-minute slot over the last hour, across the client's own running devices
  // (ids come from the client's mirror rows, never from a request). Slots with no reading stay in the list as nulls.
  latencyHistory(orgId: number) {
    return ttlMemo(`latency:${orgId}`, 60_000, () => DeviceMonitorService.loadLatencyHistory(orgId));
  },

  async loadLatencyHistory(orgId: number) {
    const { SLOT, SLOTS, start } = slotWindow();

    const devices = (await DeviceService.listByOrg(orgId)).filter((d) => d.status === "ACTIVE" && d.engineDeviceId);
    const perDevice = await Promise.all(
      devices.map(async (d) => {
        try {
          const r = await call(orgId, () =>
            engine.metrics(d.engineDeviceId!, { metric: "icmp_latency_ms", from: new Date(start), bucketSec: SLOT / 1000, limit: 100 }),
          );
          return { id: d.id, name: d.name, items: r.items as MetricBucket[] };
        } catch {
          return { id: d.id, name: d.name, items: [] as MetricBucket[] };
        }
      }),
    );

    const slots = Array.from({ length: SLOTS }, (_, i) => ({ t: start + i * SLOT, devices: [] as { id: number; name: string; avg: number }[] }));
    for (const dev of perDevice) {
      for (const b of dev.items) {
        if (b.avg === null) continue;
        const slot = slots[Math.floor((new Date(b.time).getTime() - start) / SLOT)];
        if (slot) slot.devices.push({ id: dev.id, name: dev.name, avg: b.avg });
      }
    }
    return {
      deviceCount: devices.length,
      slots: slots.map((s) => ({
        t: s.t,
        avg: s.devices.length ? s.devices.reduce((sum, d) => sum + d.avg, 0) / s.devices.length : null,
        devices: s.devices.sort((a, b) => b.avg - a.avg),
      })),
    };
  },

  // What the dashboard device list shows besides the live health: type, checks, current traffic, and a latency trend.
  // Keyed by our device id. Anything the engine cannot answer is simply left out (the list still renders).
  deviceExtras(orgId: number) {
    return ttlMemo(`extras:${orgId}`, 30_000, () => DeviceMonitorService.loadDeviceExtras(orgId));
  },

  async loadDeviceExtras(orgId: number): Promise<Record<number, DeviceExtra>> {
    const devices = (await DeviceService.listByOrg(orgId)).filter((d) => d.engineDeviceId);
    if (devices.length === 0) return {};
    const ids = devices.map((d) => d.engineDeviceId!);
    const running = devices.filter((d) => d.status === "ACTIVE");

    const [list, history, rates] = await Promise.all([
      call(orgId, () => engine.listDevices(ids)).catch(() => ({ items: [] })),
      DeviceMonitorService.latencyHistory(orgId).catch(() => null),
      Promise.all(
        running.map(async (d) => {
          try {
            const r = await call(orgId, () => engine.interfaces(d.engineDeviceId!));
            const live = r.items.filter((i) => i.monitored && i.active && i.type !== null && PHYSICAL_IF_TYPES.has(i.type) && i.latest);
            if (live.length === 0) return [d.id, null] as const;
            return [d.id, live.reduce((sum, i) => sum + (i.latest!.inBps ?? 0) + (i.latest!.outBps ?? 0), 0)] as const;
          } catch {
            return [d.id, null] as const;
          }
        }),
      ),
    ]);

    const byEngine = new Map(list.items.map((e) => [e.id, e]));
    const rateOf = new Map(rates);
    const out: Record<number, DeviceExtra> = {};
    for (const d of devices) {
      const e = byEngine.get(d.engineDeviceId!);
      out[d.id] = {
        deviceType: e?.deviceType ?? "unknown",
        vendor: e?.vendor ?? null,
        model: e?.model ?? null,
        icmp: e?.icmpEnabled ?? false,
        snmp: e?.snmpEnabled ?? false,
        tcpPorts: e?.tcpPorts.length ?? 0,
        throughputBps: rateOf.get(d.id) ?? null,
        latencySeries: history ? history.slots.map((s) => s.devices.find((x) => x.id === d.id)?.avg ?? null) : [],
      };
    }
    return out;
  },

  // Total traffic (in + out) of all monitored physical interfaces of the client's running devices, per 5-minute slot over the last hour.
  // Interfaces come from the engine's list for each of the client's own devices.
  trafficHistory(orgId: number) {
    return ttlMemo(`traffic:${orgId}`, 60_000, () => DeviceMonitorService.loadTrafficHistory(orgId));
  },

  async loadTrafficHistory(orgId: number) {
    const { SLOT, SLOTS, start } = slotWindow(true);
    const devices = (await DeviceService.listByOrg(orgId)).filter((d) => d.status === "ACTIVE" && d.engineDeviceId);

    let interfaceCount = 0;
    const perInterface = await Promise.all(
      devices.map(async (d) => {
        try {
          const list = await call(orgId, () => engine.interfaces(d.engineDeviceId!));
          const monitored = list.items.filter((i) => i.monitored && i.active && i.type !== null && PHYSICAL_IF_TYPES.has(i.type));
          interfaceCount += monitored.length;
          return await Promise.all(
            monitored.map(async (i) => {
              const r = await call(orgId, () =>
                engine.interfaceMetrics(d.engineDeviceId!, i.id, { from: new Date(start), bucketSec: SLOT / 1000 }),
              );
              return r.items;
            }),
          );
        } catch {
          return [];
        }
      }),
    );

    const totals: (number | null)[] = Array.from({ length: SLOTS }, () => null);
    for (const buckets of perInterface.flat()) {
      for (const b of buckets) {
        if (b.inBpsAvg === null && b.outBpsAvg === null) continue;
        const idx = Math.floor((new Date(b.time).getTime() - start) / SLOT);
        if (idx < 0 || idx >= SLOTS) continue;
        totals[idx] = (totals[idx] ?? 0) + (b.inBpsAvg ?? 0) + (b.outBpsAvg ?? 0);
      }
    }
    return {
      interfaceCount,
      slots: totals.map((bps, i) => ({ t: start + i * SLOT, bps })),
    };
  },

  async detail(orgId: number, id: number) {
    const device = await DeviceService.getOwned(orgId, id);
    if (!device.engineDeviceId) throw new AppError("This device is still being created.");
    const status = await call(orgId, () => engine.deviceStatus(device.engineDeviceId!));
    return { device, status };
  },

  async metrics(orgId: number, id: number, range: RangeKey) {
    const device = await DeviceService.getOwned(orgId, id);
    const engineId = device.engineDeviceId;
    if (!engineId) return {};
    const { ms, bucketSec } = RANGES[range];
    const from = new Date(Date.now() - ms);
    const names = ["cpu_pct", "memory_pct", "icmp_latency_ms", "icmp_packet_loss_pct", "snmp_response_ms"];
    const results = await Promise.all(
      names.map((metric) => call(orgId, () => engine.metrics(engineId, { metric, from, bucketSec, limit: 1000 }))),
    );
    return Object.fromEntries(names.map((n, i) => [n, results[i].items as MetricBucket[]]));
  },

  async interfaces(orgId: number, id: number) {
    const device = await DeviceService.getOwned(orgId, id);
    if (!device.engineDeviceId) return [];
    return (await call(orgId, () => engine.interfaces(device.engineDeviceId!))).items;
  },

  async interfaceTraffic(orgId: number, id: number, interfaceId: string, range: RangeKey) {
    const device = await DeviceService.getOwned(orgId, id);
    const engineId = device.engineDeviceId;
    if (!engineId) throw new AppError("Not found", 404);
    // the interface must belong to this device (which the client owns)
    const list = await call(orgId, () => engine.interfaces(engineId));
    if (!list.items.some((i) => i.id === interfaceId)) throw new AppError("Not found", 404);
    const { ms, bucketSec } = RANGES[range];
    const r = await call(orgId, () => engine.interfaceMetrics(engineId, interfaceId, { from: new Date(Date.now() - ms), bucketSec }));
    return r.items;
  },

  // Sums per-bucket traffic across several interfaces (the device's "all ports" view). One engine call per interface.
  async interfaceTrafficMany(orgId: number, id: number, interfaceIds: string[], range: RangeKey): Promise<InterfaceBucket[]> {
    const device = await DeviceService.getOwned(orgId, id);
    const engineId = device.engineDeviceId;
    if (!engineId || interfaceIds.length === 0) return [];
    // the interfaces must belong to this device (which the client owns)
    const list = await call(orgId, () => engine.interfaces(engineId));
    const valid = new Set(list.items.map((i) => i.id));
    const ids = interfaceIds.filter((x) => valid.has(x));
    const { ms, bucketSec } = RANGES[range];
    const from = new Date(Date.now() - ms);
    const results = await Promise.all(ids.map((ifaceId) => call(orgId, () => engine.interfaceMetrics(engineId, ifaceId, { from, bucketSec }))));

    const merged = new Map<string, InterfaceBucket>();
    for (const { items } of results) {
      for (const b of items) {
        const cur = merged.get(b.time) ?? { time: b.time, interfaceId: "all", inBpsAvg: null, inBpsMax: null, outBpsAvg: null, outBpsMax: null, samples: 0 };
        cur.inBpsAvg = (cur.inBpsAvg ?? 0) + (b.inBpsAvg ?? 0);
        cur.inBpsMax = (cur.inBpsMax ?? 0) + (b.inBpsMax ?? 0);
        cur.outBpsAvg = (cur.outBpsAvg ?? 0) + (b.outBpsAvg ?? 0);
        cur.outBpsMax = (cur.outBpsMax ?? 0) + (b.outBpsMax ?? 0);
        cur.samples += b.samples;
        merged.set(b.time, cur);
      }
    }
    return [...merged.values()].sort((a, b) => a.time.localeCompare(b.time));
  },

  async setInterfaceMonitored(actor: { id: number }, orgId: number, id: number, interfaceId: string, monitored: boolean) {
    await requireLive(orgId);
    const device = await DeviceService.getOwned(orgId, id);
    const engineId = device.engineDeviceId;
    if (!engineId) throw new AppError("Not found", 404);
    const list = await call(orgId, () => engine.interfaces(engineId));
    if (!list.items.some((i) => i.id === interfaceId)) throw new AppError("Not found", 404);
    await call(orgId, () => engine.setInterfaceMonitored(engineId, interfaceId, monitored));
    await AuditService.log({ actorId: actor.id, orgId, action: "interface.monitored", targetType: "Device", targetId: id, metadata: { interfaceId, monitored } });
  },
};
