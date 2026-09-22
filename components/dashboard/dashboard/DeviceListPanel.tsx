import { mapStateOf } from "../map/map-types";
import { DeviceMonitorService, type DeviceExtra } from "@/servers/services/device-monitor.service";
import DeviceList from "./DeviceList";
import { STATE_ORDER, type DeviceItem } from "./device-list-types";

// What the state badge says: a device still being created or paused says so (and why), otherwise the engine's health word.
function healthLabel(status: string, pausedBy: string | null, reachability: string | undefined) {
  if (status === "PENDING") return "CREATING";
  if (status !== "ACTIVE") return pausedBy === "SUBSCRIPTION" ? "PAUSED (PLAN)" : "PAUSED";
  return reachability ?? "UNKNOWN";
}

type Rows = Awaited<ReturnType<typeof DeviceMonitorService.fleet>>["rows"];

type Props = {
  orgId: number;
  rows: Rows;
  addHref: string;
  addLabel: string;
  canAdd: boolean;
  initialView?: "grid" | "table";
  title?: string;
  className?: string;
};

// The client's devices, worst first. The live health comes from the fleet snapshot the dashboard already loaded;
// type, checks, traffic and the latency trend load here so the rest of the page never waits for them.
export default async function DeviceListPanel({ orgId, rows, addHref, addLabel, canAdd, initialView, title, className }: Props) {
  const extras = await DeviceMonitorService.deviceExtras(orgId).catch((): Record<number, DeviceExtra> => ({}));

  const devices: DeviceItem[] = rows
    .map(({ device, fleet }) => {
      const x = extras[device.id];
      const state = mapStateOf(device.status, fleet?.reachability);
      return {
        id: device.id,
        name: device.name,
        host: fleet?.host ?? "",
        state,
        health: healthLabel(device.status, device.disabledBy, fleet?.reachability),
        snmpHealth: device.status === "ACTIVE" && x?.snmp && fleet?.snmp && fleet.snmp !== "UNKNOWN" ? fleet.snmp : null,
        deviceType: x?.deviceType ?? "unknown",
        vendor: x?.vendor ?? null,
        icmp: x?.icmp ?? false,
        snmp: x?.snmp ?? false,
        tcpPorts: x?.tcpPorts ?? 0,
        cpuPct: fleet?.cpuPct ?? null,
        memoryPct: fleet?.memoryPct ?? null,
        latencyMs: fleet?.latencyMs ?? null,
        throughputBps: x?.throughputBps ?? null,
        latencySeries: x?.latencySeries ?? [],
        incidents: fleet?.activeIncidents ?? 0,
        lastPollAt: fleet?.lastPollAt ?? null,
      };
    })
    .sort((a, b) => STATE_ORDER[a.state] - STATE_ORDER[b.state] || a.name.localeCompare(b.name));

  return <DeviceList devices={devices} addHref={addHref} addLabel={addLabel} canAdd={canAdd} initialView={initialView} title={title} className={className} />;
}
