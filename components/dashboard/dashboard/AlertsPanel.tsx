import { IncidentService } from "@/servers/services/incident.service";
import AlertsCard, { type AlertRow } from "./AlertsCard";

const SHOWN = 5;

// The client's most recent incidents (any status), newest first. Loads on its own so the stat tiles never wait for it.
export default async function AlertsPanel({ orgId, className }: { orgId: number; className?: string }) {
  const { items } = await IncidentService.list(orgId, {}).catch(() => ({ items: [] }));

  const rows: AlertRow[] = items
    .sort((a, b) => new Date(b.incident.triggeredAt).getTime() - new Date(a.incident.triggeredAt).getTime())
    .slice(0, SHOWN)
    .map(({ incident, device }) => ({
      id: incident.id,
      title: incident.title,
      deviceName: device?.name ?? "removed device",
      severity: incident.severity,
      status: incident.status,
      triggeredAt: incident.triggeredAt,
    }));

  return <AlertsCard rows={rows} className={className} />;
}
