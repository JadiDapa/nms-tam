import type { HealthState } from "@/servers/engine/engine-types";

// What the map shows for a device. "warning" covers degraded, recovering and not-yet-known.
export type MapState = "up" | "warning" | "down" | "paused";

export type MapPoint = {
  id: number;
  name: string;
  host: string;
  lat: number;
  lng: number;
  state: MapState;
  latencyMs: number | null;
  lastPollAt: string | null;
};

export const MAP_STATES: MapState[] = ["up", "warning", "down", "paused"];

export const STATE_META: Record<MapState, { label: string; color: string; tone: "green" | "yellow" | "red" | "gray" }> = {
  up: { label: "Up", color: "#22c55e", tone: "green" },
  warning: { label: "Degraded / unknown", color: "#f59e0b", tone: "yellow" },
  down: { label: "Down", color: "#ef4444", tone: "red" },
  paused: { label: "Paused", color: "#9ca3af", tone: "gray" },
};

// A paused device is not being polled, so its last health reading says nothing about now.
export function mapStateOf(deviceStatus: string, reachability: HealthState | undefined): MapState {
  if (deviceStatus !== "ACTIVE") return "paused";
  if (reachability === "UP") return "up";
  if (reachability === "DOWN") return "down";
  return "warning";
}
