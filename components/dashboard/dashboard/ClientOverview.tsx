import { Suspense } from "react";
import { format } from "date-fns";
import { CalendarDays } from "lucide-react";
import ChartCardSkeleton from "./ChartCardSkeleton";
import ClientStatGroup from "./ClientStatGroup";
import LatencyPanel from "./LatencyPanel";
import DeviceMapCard from "../map/DeviceMapCard";
import DeviceListPanel from "./DeviceListPanel";
import { mapStateOf, type MapPoint } from "../map/map-types";
import AlertsPanel from "./AlertsPanel";
import TrafficPanel from "./TrafficPanel";
import AutoRefresh from "../AutoRefresh";
import PageHeader from "../PageHeader";
import { DeviceMonitorService } from "@/servers/services/device-monitor.service";
import { IncidentService } from "@/servers/services/incident.service";
import { SubscriptionService } from "@/servers/services/subscription.service";

export default async function ClientOverview({ orgId }: { orgId: number }) {
  const [{ rows, engineOk }, ent, incidents] = await Promise.all([
    DeviceMonitorService.fleet(orgId),
    SubscriptionService.getEntitlements(orgId),
    IncidentService.list(orgId, { status: "ACTIVE" }).catch(() => ({
      items: [],
      total: 0,
    })),
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

  const full = rows.length >= ent.deviceLimit;
  const canAdd = ent.live && !full;
  const addLabel = canAdd
    ? "Add device"
    : full
      ? "Quota full: request slots"
      : "Subscription inactive";

  return (
    <main className="w-full space-y-6">
      <AutoRefresh seconds={15} />
      <div className="flex items-center justify-between">
        <PageHeader
          title="Dashboard"
          subtitle="How your network is doing right now."
        />
        <div className="text-muted-foreground flex items-center gap-1.5 text-sm">
          <CalendarDays className="size-4" />
          {format(new Date(), "dd MMMM yyyy")}
        </div>
      </div>

      {!engineOk && (
        <p className="bg-destructive/10 text-destructive rounded-lg px-4 py-2 text-sm">
          Live status is temporarily unavailable. The numbers below may be
          incomplete.
        </p>
      )}

      {/* Four stat tiles in one panel, latency chart beside it */}
      <div className="grid gap-4 lg:grid-cols-5">
        <ClientStatGroup
          rows={rows}
          deviceLimit={ent.deviceLimit}
          activeIncidents={incidents.total}
          className="lg:col-span-2"
        />
        <Suspense fallback={<ChartCardSkeleton className="lg:col-span-3" />}>
          <LatencyPanel orgId={orgId} className="lg:col-span-3" />
        </Suspense>
      </div>

      {/* Traffic chart with the latest alerts beside it */}
      <div className="grid gap-4 lg:grid-cols-5">
        <Suspense fallback={<ChartCardSkeleton className="lg:col-span-3" />}>
          <TrafficPanel orgId={orgId} className="lg:col-span-3" />
        </Suspense>
        <Suspense fallback={<ChartCardSkeleton className="lg:col-span-2" />}>
          <AlertsPanel orgId={orgId} className="lg:col-span-2" />
        </Suspense>
      </div>

      <DeviceMapCard
        points={mapPoints}
        unlocated={rows.length - mapPoints.length}
      />

      <Suspense fallback={<ChartCardSkeleton />}>
        <DeviceListPanel
          orgId={orgId}
          rows={rows}
          canAdd={canAdd}
          addHref={canAdd ? "/dashboard/devices/new" : "/dashboard/billing"}
          addLabel={addLabel}
        />
      </Suspense>
    </main>
  );
}
