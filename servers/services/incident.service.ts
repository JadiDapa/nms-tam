import { AppError } from "@/lib/errors";
import { engine } from "../engine/engine-client";
import { call, stripEngineName } from "../engine/engine-call";
import type { EngineIncident } from "../engine/engine-types";
import { AuditService } from "./audit.service";
import { DeviceService } from "./device.service";

export type IncidentFilter = { status?: string; severity?: string };

// The engine names a client's rules "o12:High CPU" to keep clients apart; that prefix must never reach a screen.
// Incident titles are "<rule name>: <device>", so they carry it too.
const readable = (orgId: number, i: EngineIncident): EngineIncident => ({
  ...i,
  ruleName: stripEngineName(orgId, i.ruleName),
  title: stripEngineName(orgId, i.title),
});

export const IncidentService = {
  async list(orgId: number, filter: IncidentFilter = {}) {
    const devices = await DeviceService.listByOrg(orgId);
    const ids = devices.map((d) => d.engineDeviceId).filter((x): x is string => x !== null);
    const r = await call(orgId, () => engine.listIncidents({ deviceIds: ids, status: filter.status, severity: filter.severity, limit: 200 }));
    const byEngine = new Map(devices.map((d) => [d.engineDeviceId, d]));
    return {
      total: r.total,
      items: r.items.map((incident) => ({ incident: readable(orgId, incident), device: byEngine.get(incident.deviceId) ?? null })),
    };
  },

  // An incident belongs to the client that owns its device; anything else looks like it does not exist.
  async get(orgId: number, incidentId: string) {
    const detail = await call(orgId, () => engine.getIncident(incidentId));
    const device = await DeviceService.getByEngineId(orgId, detail.incident.deviceId);
    if (!device) throw new AppError("Incident not found", 404);
    return { ...detail, incident: readable(orgId, detail.incident), device };
  },

  async acknowledge(actor: { id: number; email: string }, orgId: number, incidentId: string) {
    await IncidentService.get(orgId, incidentId);
    await call(orgId, () => engine.acknowledgeIncident(incidentId, actor.email));
    await AuditService.log({ actorId: actor.id, orgId, action: "incident.acknowledge", targetType: "Incident", targetId: incidentId });
  },
};
