// Turns an alert rule into a sentence a person can read, instead of "cpu_pct > 90".
import { formatDuration } from "./format";

export type RuleText = {
  conditionType: string;
  metric: string | null;
  operator: string | null;
  threshold: number | null;
  triggerAfter: number;
  clearAfter: number;
  cooldownSec: number;
  notifyOnRecovery: boolean;
};

const METRIC: Record<string, { label: string; unit: string }> = {
  cpu_pct: { label: "CPU usage", unit: "%" },
  memory_pct: { label: "Memory usage", unit: "%" },
  icmp_latency_ms: { label: "Ping latency", unit: " ms" },
  icmp_packet_loss_pct: { label: "Packet loss", unit: "%" },
  snmp_response_ms: { label: "SNMP response time", unit: " ms" },
  if_in_bps: { label: "Inbound traffic", unit: " bps" },
  if_out_bps: { label: "Outbound traffic", unit: " bps" },
};

const OPERATOR: Record<string, string> = {
  ">": "goes above",
  ">=": "reaches",
  "<": "drops below",
  "<=": "drops to",
  "==": "equals",
  "!=": "is anything but",
};

// "CPU usage goes above 90%", "The device stops answering"
export function ruleHeadline(r: RuleText): string {
  switch (r.conditionType) {
    case "device_down":
      return "The device stops answering";
    case "snmp_unavailable":
      return "SNMP stops responding";
    case "interface_down":
      return "A monitored interface goes down";
    default: {
      const m = r.metric ? (METRIC[r.metric] ?? { label: r.metric, unit: "" }) : { label: "A value", unit: "" };
      const op = (r.operator && OPERATOR[r.operator]) || "crosses";
      return r.threshold === null ? `${m.label} ${op}` : `${m.label} ${op} ${r.threshold}${m.unit}`;
    }
  }
}

const times = (n: number, noun: string) => `${n} ${noun}${n === 1 ? "" : "s"}`;

// "3 checks in a row to alert · 3 to clear · quiet for 5m 0s after"
export function ruleTiming(r: RuleText): string {
  const parts = [`${times(r.triggerAfter, "check")} in a row to alert`, `${r.clearAfter} to clear`];
  if (r.cooldownSec > 0) parts.push(`quiet for ${formatDuration(r.cooldownSec * 1000)} after`);
  if (!r.notifyOnRecovery) parts.push("no recovery message");
  return parts.join(" · ");
}
