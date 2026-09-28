import { Suspense } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { timeAgo } from "@/lib/format";
import AutoRefresh from "@/components/dashboard/AutoRefresh";
import ChartCardSkeleton from "@/components/dashboard/dashboard/ChartCardSkeleton";
import ClientStatGroup from "@/components/dashboard/dashboard/ClientStatGroup";
import LatencyPanel from "@/components/dashboard/dashboard/LatencyPanel";
import TrafficPanel from "@/components/dashboard/dashboard/TrafficPanel";
import AlertsPanel from "@/components/dashboard/dashboard/AlertsPanel";
import DeviceMapCard from "@/components/dashboard/map/DeviceMapCard";
import { mapStateOf, type MapPoint } from "@/components/dashboard/map/map-types";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DeviceMonitorService } from "@/servers/services/device-monitor.service";
import { IncidentService } from "@/servers/services/incident.service";
import { SubscriptionService } from "@/servers/services/subscription.service";
import { BillingRequestService } from "@/servers/services/billing-request.service";
import { AuditService } from "@/servers/services/audit.service";

type Props = {
  params: Promise<{ id: string }>;
};

// The client's health at a glance: the same tiles and charts as their own dashboard, plus quick admin nudges
// (open requests, latest activity) that link out to the dedicated tabs instead of dumping everything here.
export default async function OrganizationOverviewPage({ params }: Props) {
  await requireAdmin();
  const id = Number((await params).id);

  const [ent, { rows, engineOk }, incidents, openRequests, audit] = await Promise.all([
    SubscriptionService.getEntitlements(id),
    DeviceMonitorService.fleet(id),
    IncidentService.list(id, { status: "ACTIVE" }).catch(() => ({ items: [], total: 0 })),
    BillingRequestService.list({ orgId: id, status: "OPEN" }),
    AuditService.list({ orgId: id, take: 5 }),
  ]);

  const mapPoints: MapPoint[] = rows.flatMap(({ device, fleet }) =>
    device.latitude != null && device.longitude != null
      ? [
          {
            id: device.id,
            name: device.name,
            host: fleet?.host ?? "",
            lat: device.latitude,
            lng: device.longitude,
            state: mapStateOf(device.status, fleet?.reachability),
            latencyMs: fleet?.latencyMs ?? null,
            lastPollAt: fleet?.lastPollAt ?? null,
          },
        ]
      : [],
  );

  return (
    <div className="space-y-6">
      <AutoRefresh seconds={15} />

      {openRequests.length > 0 && (
        <Link
          href={`/dashboard/admin/organizations/${id}/billing`}
          className="flex items-center justify-between rounded-lg bg-yellow-500/10 px-4 py-3 text-sm text-yellow-700 transition-colors hover:bg-yellow-500/15 dark:text-yellow-500"
        >
          <span>
            {openRequests.length} open billing request{openRequests.length === 1 ? "" : "s"} waiting on you
          </span>
          <ArrowRight className="size-4" />
        </Link>
      )}

      {!engineOk && (
        <p className="bg-destructive/10 text-destructive rounded-lg px-4 py-2 text-sm">
          Live status is temporarily unavailable. The numbers below may be incomplete.
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-5">
        <ClientStatGroup rows={rows} deviceLimit={ent.deviceLimit} activeIncidents={incidents.total} className="lg:col-span-2" />
        <Suspense fallback={<ChartCardSkeleton className="lg:col-span-3" />}>
          <LatencyPanel orgId={id} className="lg:col-span-3" />
        </Suspense>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Suspense fallback={<ChartCardSkeleton className="lg:col-span-3" />}>
          <TrafficPanel orgId={id} className="lg:col-span-3" />
        </Suspense>
        <Suspense fallback={<ChartCardSkeleton className="lg:col-span-2" />}>
          <AlertsPanel orgId={id} className="lg:col-span-2" />
        </Suspense>
      </div>

      <DeviceMapCard points={mapPoints} unlocated={rows.length - mapPoints.length} />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Recent activity</CardTitle>
          <Link href={`/dashboard/admin/organizations/${id}/activity`} className="text-muted-foreground hover:text-foreground text-xs">
            View all →
          </Link>
        </CardHeader>
        <CardContent className="p-0">
          <ul className="divide-y text-sm">
            {audit.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-4 px-5 py-2.5">
                <StatusBadge label={a.action} tone="blue" />
                <span className="text-muted-foreground text-xs whitespace-nowrap">{timeAgo(a.createdAt)}</span>
              </li>
            ))}
            {audit.length === 0 && <li className="text-muted-foreground px-5 py-8 text-center">Nothing yet.</li>}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
