import { Suspense } from "react";
import { requireClient } from "@/lib/auth";
import PageHeader from "@/components/dashboard/PageHeader";
import AutoRefresh from "@/components/dashboard/AutoRefresh";
import ChartCardSkeleton from "@/components/dashboard/dashboard/ChartCardSkeleton";
import ClientStatGroup from "@/components/dashboard/dashboard/ClientStatGroup";
import DeviceListPanel from "@/components/dashboard/dashboard/DeviceListPanel";
import LatencyPanel from "@/components/dashboard/dashboard/LatencyPanel";
import TrafficPanel from "@/components/dashboard/dashboard/TrafficPanel";
import { DeviceMonitorService } from "@/servers/services/device-monitor.service";
import { IncidentService } from "@/servers/services/incident.service";
import { SubscriptionService } from "@/servers/services/subscription.service";

export default async function DevicesPage() {
  const { orgId } = await requireClient();
  const [{ rows, engineOk }, ent, incidents] = await Promise.all([
    DeviceMonitorService.fleet(orgId),
    SubscriptionService.getEntitlements(orgId),
    IncidentService.list(orgId, { status: "ACTIVE" }).catch(() => ({ items: [], total: 0 })),
  ]);

  const full = rows.length >= ent.deviceLimit;
  const canAdd = ent.live && !full;
  const addLabel = canAdd ? "Add device" : full ? "Quota full: request slots" : "Subscription inactive";

  return (
    <main className="w-full space-y-6">
      <AutoRefresh seconds={15} />
      <PageHeader title="Devices" subtitle="Everything you monitor, refreshed automatically." />

      {!engineOk && (
        <p className="bg-destructive/10 text-destructive rounded-lg px-4 py-2 text-sm">
          Live status is temporarily unavailable. Your devices are listed, but their health cannot be shown right now.
        </p>
      )}

      {/* the four tiles (2 x 2) with the two charts stacked beside them, the same height as the tiles */}
      <div className="grid gap-4 lg:grid-cols-5">
        <ClientStatGroup rows={rows} deviceLimit={ent.deviceLimit} activeIncidents={incidents.total} className="lg:col-span-2" />
        <div className="flex flex-col gap-4 lg:col-span-3">
          <Suspense fallback={<ChartCardSkeleton compact className="flex-1" />}>
            <LatencyPanel orgId={orgId} compact className="flex-1" />
          </Suspense>
          <Suspense fallback={<ChartCardSkeleton compact className="flex-1" />}>
            <TrafficPanel orgId={orgId} compact className="flex-1" />
          </Suspense>
        </div>
      </div>

      <Suspense fallback={<ChartCardSkeleton />}>
        <DeviceListPanel
          orgId={orgId}
          rows={rows}
          canAdd={canAdd}
          addHref={canAdd ? "/dashboard/devices/new" : "/dashboard/billing"}
          addLabel={addLabel}
          title="All devices"
        />
      </Suspense>
    </main>
  );
}
