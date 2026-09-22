import type { MapState } from "../map/map-types";

// Everything the device list needs about one device, as plain values (safe to pass to client components).
export type DeviceItem = {
  id: number;
  name: string;
  host: string;
  state: MapState;
  // the engine's health word (UP, DOWN, DEGRADED...) or PAUSED
  health: string;
  // SNMP health when SNMP is switched on and the device is running
  snmpHealth: string | null;
  deviceType: string;
  vendor: string | null;
  icmp: boolean;
  snmp: boolean;
  tcpPorts: number;
  cpuPct: number | null;
  memoryPct: number | null;
  latencyMs: number | null;
  throughputBps: number | null;
  latencySeries: (number | null)[];
  incidents: number;
  lastPollAt: string | null;
};

export const STATE_ORDER: Record<MapState, number> = { down: 0, warning: 1, up: 2, paused: 3 };

export const typeLabel = (t: string) => t.replace("_", " ");

export type SortKey = "name" | "state" | "cpu" | "memory" | "latency" | "traffic" | "lastPoll";
export type SortDir = "asc" | "desc";

// Sorts a copy of the list; devices without a reading always go last, whichever way it is sorted.
export function sortDevices(list: DeviceItem[], key: SortKey | null, dir: SortDir): DeviceItem[] {
  if (!key) return list;
  const value = (d: DeviceItem): number | string | null => {
    switch (key) {
      case "name":
        return d.name.toLowerCase();
      case "state":
        return STATE_ORDER[d.state];
      case "cpu":
        return d.cpuPct;
      case "memory":
        return d.memoryPct;
      case "latency":
        return d.latencyMs;
      case "traffic":
        return d.throughputBps;
      case "lastPoll":
        return d.lastPollAt ? Date.parse(d.lastPollAt) : null;
    }
  };
  return [...list].sort((a, b) => {
    const x = value(a);
    const y = value(b);
    if (x === null && y === null) return 0;
    if (x === null) return 1;
    if (y === null) return -1;
    const c = typeof x === "string" ? x.localeCompare(y as string) : x - (y as number);
    return dir === "asc" ? c : -c;
  });
}
