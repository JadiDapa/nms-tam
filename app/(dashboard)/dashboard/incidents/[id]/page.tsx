import Link from "next/link";
import { notFound } from "next/navigation";
import { requireClient } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { formatDateTime, timeAgo } from "@/lib/format";
import PageHeader from "@/components/dashboard/PageHeader";
import AcknowledgeButton from "@/components/dashboard/incidents/AcknowledgeButton";
import { DeliveryBadge, IncidentBadge, SeverityBadge } from "@/components/dashboard/StatusBadge";
import { IncidentService } from "@/servers/services/incident.service";
import { ResourceService } from "@/servers/services/resource.service";

type Props = {
  params: Promise<{ id: string }>;
};

const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex justify-between gap-4 border-b py-2 text-sm last:border-b-0">
    <span className="text-muted-foreground">{label}</span>
    <span className="text-right font-medium">{children}</span>
  </div>
);

export default async function IncidentPage({ params }: Props) {
  const { orgId } = await requireClient();
  const { id } = await params;

  let detail;
  try {
    detail = await IncidentService.get(orgId, id);
  } catch (err) {
    if (err instanceof AppError && (err.status === 404 || err.status === 400)) notFound();
    throw err;
  }
  const { incident, deliverySummary, device } = detail;

  const channels = await ResourceService.listByOrg(orgId, "CHANNEL");
  const channelName = (engineId: string | null) => channels.find((c) => c.engineId === engineId)?.label ?? "removed channel";

  return (
    <main className="w-full space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <PageHeader title={incident.title} subtitle={`Rule: ${incident.ruleName}`} />
          <div className="flex items-center gap-2">
            <SeverityBadge severity={incident.severity} />
            <IncidentBadge status={incident.status} />
          </div>
        </div>
        {incident.status === "OPEN" && <AcknowledgeButton incidentId={incident.id} />}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="bg-card rounded-lg border p-4">
          <h3 className="mb-2 font-medium">Details</h3>
          <Row label="Device">
            <Link href={`/dashboard/devices/${device.id}`} className="hover:underline">
              {device.name}
            </Link>
          </Row>
          <Row label="Started">
            {formatDateTime(incident.triggeredAt)} <span className="text-muted-foreground font-normal">({timeAgo(incident.triggeredAt)})</span>
          </Row>
          {incident.metric && (
            <Row label="Metric">
              {incident.metric}: {incident.value ?? "—"} (threshold {incident.threshold ?? "—"})
            </Row>
          )}
          {incident.error && <Row label="Error">{incident.error}</Row>}
          {incident.acknowledgedAt && (
            <Row label="Acknowledged">
              {formatDateTime(incident.acknowledgedAt)}
              {incident.acknowledgedBy && ` by ${incident.acknowledgedBy}`}
            </Row>
          )}
          {incident.resolvedAt && (
            <Row label="Resolved">
              {formatDateTime(incident.resolvedAt)}
              {incident.resolutionReason && <span className="text-muted-foreground font-normal"> ({incident.resolutionReason})</span>}
            </Row>
          )}
          <Row label="Last seen">{timeAgo(incident.lastSeenAt)}</Row>
        </div>

        <div className="bg-card rounded-lg border p-4">
          <h3 className="mb-2 font-medium">Notifications</h3>
          {deliverySummary.length === 0 ? (
            <p className="text-muted-foreground text-sm">No notification was sent for this incident (the rule has no channel).</p>
          ) : (
            <ul className="space-y-3">
              {deliverySummary.map((d, i) => (
                <li key={i} className="text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{channelName(d.channelId)}</span>
                    <span className="text-muted-foreground text-xs">{d.channelType} · {d.event}</span>
                    <DeliveryBadge phase={d.phase} />
                  </div>
                  <p className="text-muted-foreground text-xs">
                    {d.attempts} attempt{d.attempts === 1 ? "" : "s"}
                    {d.sentAt && ` · delivered ${timeAgo(d.sentAt)}`}
                    {d.nextAttemptAt && ` · next try ${formatDateTime(d.nextAttemptAt)}`}
                  </p>
                  {d.lastError && <p className="text-destructive text-xs">{d.lastError}</p>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </main>
  );
}
