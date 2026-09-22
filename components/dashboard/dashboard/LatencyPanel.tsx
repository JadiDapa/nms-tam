import { DeviceMonitorService } from "@/servers/services/device-monitor.service";
import LatencyChart from "./LatencyChart";

// Loads its own data so the stat tiles never wait for the metric history.
export default async function LatencyPanel({ orgId, compact, className }: { orgId: number; compact?: boolean; className?: string }) {
  const latency = await DeviceMonitorService.latencyHistory(orgId).catch(() => ({ deviceCount: 0, slots: [] }));
  return <LatencyChart compact={compact} className={className} slots={latency.slots} deviceCount={latency.deviceCount} />;
}
