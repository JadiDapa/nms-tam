import { DeviceMonitorService } from "@/servers/services/device-monitor.service";
import TrafficChart from "./TrafficChart";

export default async function TrafficPanel({ orgId, compact, className }: { orgId: number; compact?: boolean; className?: string }) {
  const traffic = await DeviceMonitorService.trafficHistory(orgId).catch(() => ({ interfaceCount: 0, slots: [] }));
  return <TrafficChart compact={compact} className={className} slots={traffic.slots} interfaceCount={traffic.interfaceCount} />;
}
