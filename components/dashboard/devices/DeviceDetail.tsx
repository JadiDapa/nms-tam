import { Suspense, type ReactNode } from "react";
import { notFound } from "next/navigation";
import { AppError } from "@/lib/errors";
import { reachabilityRibbon } from "@/lib/availability";
import AutoRefresh from "@/components/dashboard/AutoRefresh";
import DateRangePicker from "@/components/dashboard/DateRangePicker";
import DeviceHeader from "./DeviceHeader";
import DeviceIncidents from "./DeviceIncidents";
import DeviceOverview from "./DeviceOverview";
import DeviceSettingsForm from "./DeviceSettingsForm";
import DeviceTabs from "./DeviceTabs";
import InterfaceSummaryCards from "./InterfaceSummaryCards";
import InterfaceTable from "./InterfaceTable";
import MetricChart, { type ChartPoint } from "./MetricChart";
import TrafficHistoryTable from "./TrafficHistoryTable";
import TrafficVolumeCards from "./TrafficVolumeCards";
import Link from "next/link";
import { formatBps } from "@/lib/format";
import { summarizeTraffic, tableGroupSec, tableLabelFormat } from "@/lib/traffic-history";
import { lastNMs, rangeParams, type ResolvedRange } from "@/lib/date-range";
import { DeviceMonitorService } from "@/servers/services/device-monitor.service";
import { DeviceGroupService } from "@/servers/services/device-group.service";
import { DeviceService } from "@/servers/services/device.service";
import { IncidentService } from "@/servers/services/incident.service";
import { SubscriptionService } from "@/servers/services/subscription.service";
import type { EngineDeviceStatus, InterfaceBucket, MetricBucket } from "@/servers/engine/engine-types";

type Props = {
  orgId: number;
  id: number;
  tab?: string;
  range: ResolvedRange;
  iface?: string;
  // where this device's own links point; defaults to the client's own device page
  basePath?: string;
  // an admin looking at a client's device: hides mutating actions and the settings tab
  readOnly?: boolean;
};

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "metrics", label: "Metrics" },
  { key: "interfaces", label: "Interfaces" },
  { key: "incidents", label: "Incidents" },
  { key: "settings", label: "Settings" },
] as const;

const DAY_MS = 24 * 3_600_000;
// the engine keeps this many state changes; when the list is full, older changes are missing
const HISTORY_LIMIT = 20;

const toPoints = (items: MetricBucket[]): ChartPoint[] => items.map((b) => ({ t: new Date(b.time).getTime(), avg: b.avg, max: b.max }));

const trafficPoints = (items: InterfaceBucket[], dir: "in" | "out"): ChartPoint[] =>
  items.map((b) => ({
    t: new Date(b.time).getTime(),
    avg: dir === "in" ? b.inBpsAvg : b.outBpsAvg,
    max: dir === "in" ? b.inBpsMax : b.outBpsMax,
  }));

// Highest (in + out) seen across the fetched range, for the "peak" caption on the total-bandwidth tile.
const peakTotal = (items: InterfaceBucket[]): number | null => {
  const totals = items.flatMap((b) => (b.inBpsAvg === null && b.outBpsAvg === null ? [] : [(b.inBpsAvg ?? 0) + (b.outBpsAvg ?? 0)]));
  return totals.length ? Math.max(...totals) : null;
};

// Squeezes a long series into a few dozen points for a small trend line (averages of neighbouring buckets; gaps stay gaps).
function downsample(items: MetricBucket[], target = 30): (number | null)[] {
  const values = items.map((b) => b.avg);
  if (values.length <= target) return values;
  const size = Math.ceil(values.length / target);
  const out: (number | null)[] = [];
  for (let i = 0; i < values.length; i += size) {
    const known = values.slice(i, i + size).filter((v): v is number => v !== null);
    out.push(known.length ? known.reduce((a, b) => a + b, 0) / known.length : null);
  }
  return out;
}

// One device: header and tabs on top, the chosen tab below. (The page only checks who is asking and hands over here.)
export default async function DeviceDetail({ orgId, id, tab: rawTab, range, iface, basePath = "/dashboard/devices", readOnly = false }: Props) {
  const tabs = readOnly ? TABS.filter((t) => t.key !== "settings") : TABS;
  const tab = tabs.some((t) => t.key === rawTab) ? rawTab! : "overview";

  let detail;
  let entitlements!: Awaited<ReturnType<typeof SubscriptionService.getEntitlements>>;
  try {
    // independent lookups (DB vs engine): run them side by side
    const [d, ent] = await Promise.all([DeviceMonitorService.detail(orgId, id), SubscriptionService.getEntitlements(orgId)]);
    detail = d;
    entitlements = ent;
  } catch (err) {
    if (err instanceof AppError && err.status === 404) notFound();
    throw err;
  }
  const { device, status } = detail;
  const ent = entitlements;

  return (
    <main className="w-full space-y-6">
      <AutoRefresh seconds={tab === "settings" ? 3600 : 15} />

      <DeviceHeader
        deviceId={id}
        name={device.name}
        ownerStatus={device.status}
        disabledBy={device.disabledBy}
        status={status}
        canChange={ent.live}
        basePath={basePath}
        readOnly={readOnly}
      />

      <DeviceTabs deviceId={id} tabs={tabs} current={tab} incidents={status.activeIncidents} basePath={basePath} />

      {tab === "overview" && <OverviewTab orgId={orgId} id={id} status={status} paused={device.status === "SUSPENDED"} />}
      {tab === "metrics" && <MetricsTab orgId={orgId} id={id} range={range} basePath={basePath} />}
      {tab === "interfaces" && <InterfacesTab orgId={orgId} id={id} range={range} selected={iface} canChange={!readOnly && ent.live} basePath={basePath} />}
      {tab === "incidents" && <IncidentsTab orgId={orgId} id={id} />}
      {!readOnly && tab === "settings" && (
        <SettingsTab orgId={orgId} id={id} status={status} canChange={ent.live} minPollIntervalSec={ent.minPollIntervalSec} />
      )}
    </main>
  );
}

async function OverviewTab({ orgId, id, status, paused }: { orgId: number; id: number; status: EngineDeviceStatus; paused: boolean }) {
  const metrics = await DeviceMonitorService.metrics(orgId, id, lastNMs(3_600_000, 30));
  const latency = metrics["icmp_latency_ms"] ?? [];
  const loss = metrics["icmp_packet_loss_pct"] ?? [];

  const ribbon = reachabilityRibbon({
    changes: status.stateHistory,
    currentState: status.state.reachability.state,
    since: status.state.reachability.since,
    now: new Date().getTime(),
    windowMs: DAY_MS,
    segments: 48,
    truncated: status.stateHistory.length >= HISTORY_LIMIT,
  });

  return (
    <DeviceOverview
      status={status}
      paused={paused}
      latencyPoints={toPoints(latency)}
      latencySeries={downsample(latency)}
      lossSeries={downsample(loss)}
      ribbon={ribbon}
    />
  );
}

async function MetricsTab({ orgId, id, range, basePath }: { orgId: number; id: number; range: ResolvedRange; basePath: string }) {
  const metrics = await DeviceMonitorService.metrics(orgId, id, range);
  const bucketSec = range.bucketSec;
  const p = (name: string) => toPoints(metrics[name] ?? []);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <DateRangePicker basePath={`${basePath}/${id}`} current={range} extra={{ tab: "metrics" }} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <MetricChart title="CPU usage" points={p("cpu_pct")} unit="pct" showMax bucketSec={bucketSec} />
        <MetricChart title="Memory usage" points={p("memory_pct")} unit="pct" showMax bucketSec={bucketSec} />
        <MetricChart title="Ping latency" points={p("icmp_latency_ms")} unit="ms" showMax bucketSec={bucketSec} />
        <MetricChart title="Packet loss" points={p("icmp_packet_loss_pct")} unit="pct" showMax bucketSec={bucketSec} />
        <MetricChart className="lg:col-span-2" title="SNMP response time" points={p("snmp_response_ms")} unit="ms" showMax bucketSec={bucketSec} />
      </div>
    </div>
  );
}

async function InterfacesTab({
  orgId,
  id,
  range,
  selected,
  canChange,
  basePath,
}: {
  orgId: number;
  id: number;
  range: ResolvedRange;
  selected?: string;
  canChange: boolean;
  basePath: string;
}) {
  const interfaces = await DeviceMonitorService.interfaces(orgId, id);
  const chosen = interfaces.find((i) => i.id === selected);
  const monitored = interfaces.filter((i) => i.monitored);
  const bucketSec = range.bucketSec;
  const rangeQS = new URLSearchParams(rangeParams(range)).toString();
  const allHref = `${basePath}/${id}?tab=interfaces&${rangeQS}`;

  // Started here but NOT awaited: the port list below renders straight away and the charts stream in when the engine
  // answers. One fetch, shared by the live rate chart and the traffic-history section (both follow the selected port,
  // or the monitored aggregate when none is).
  const traffic: Promise<InterfaceBucket[]> = chosen
    ? DeviceMonitorService.interfaceTraffic(orgId, id, chosen.id, range)
    : monitored.length > 0
      ? DeviceMonitorService.interfaceTrafficMany(
          orgId,
          id,
          monitored.map((i) => i.id),
          range,
        )
      : Promise.resolve([]);
  const streamKey = `${chosen?.id ?? "all"}|${rangeQS}`;

  let summary: ReactNode = null;

  if (chosen) {
    summary = (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Link href={allHref} className="text-muted-foreground hover:text-foreground text-sm hover:underline">
            ← All ports (aggregate)
          </Link>
          <DateRangePicker basePath={`${basePath}/${id}`} current={range} extra={{ tab: "interfaces", iface: chosen.id }} />
        </div>
        <Suspense key={streamKey} fallback={<ChartsSkeleton />}>
          <SummaryGrid
            traffic={traffic}
            bucketSec={bucketSec}
            chartTitle={`Traffic on ${chosen.name}`}
            cards={{
              inBps: chosen.latest?.inBps ?? null,
              outBps: chosen.latest?.outBps ?? null,
              capacityBps: chosen.speedBps,
              capacityLabel: chosen.speedBps ? formatBps(chosen.speedBps) : "unknown link speed",
              statusLabel: !chosen.active ? "inactive" : chosen.operStatus === "up" ? "Oper UP" : "Oper DOWN",
            }}
          />
        </Suspense>
        <p className="text-muted-foreground text-xs">Rates are computed from real counter differences. Gaps mean no valid rate was available.</p>
      </div>
    );
  } else if (monitored.length > 0) {
    const known = monitored.filter((i) => i.speedBps !== null);
    const capacityBps = known.length ? known.reduce((sum, i) => sum + (i.speedBps ?? 0), 0) : null;

    summary = (
      <div className="space-y-3">
        <div className="flex justify-end">
          <DateRangePicker basePath={`${basePath}/${id}`} current={range} extra={{ tab: "interfaces" }} />
        </div>
        <Suspense key={streamKey} fallback={<ChartsSkeleton />}>
          <SummaryGrid
            traffic={traffic}
            bucketSec={bucketSec}
            chartTitle="Traffic — all monitored ports"
            cards={{
              inBps: monitored.reduce((sum, i) => sum + (i.latest?.inBps ?? 0), 0),
              outBps: monitored.reduce((sum, i) => sum + (i.latest?.outBps ?? 0), 0),
              capacityBps,
              capacityLabel: capacityBps
                ? `${formatBps(capacityBps)} aggregate${known.length < monitored.length ? " (some ports unknown)" : ""}`
                : "unknown link speed",
              statusLabel: "Multi-port",
            }}
          />
        </Suspense>
        <p className="text-muted-foreground text-xs">
          Sum of {monitored.length} monitored port{monitored.length === 1 ? "" : "s"}. Pick a port below to see it on its own.
        </p>
      </div>
    );
  } else if (interfaces.length > 0) {
    summary = <p className="text-muted-foreground text-center text-sm">No monitored ports yet. Turn monitoring on for a port below to see its traffic.</p>;
  }

  const historyTitle = chosen ? chosen.name : monitored.length > 0 ? `${monitored.length} monitored port${monitored.length === 1 ? "" : "s"}` : null;

  return (
    <div className="space-y-4">
      {summary}
      <InterfaceTable deviceId={id} interfaces={interfaces} selected={chosen?.id} canChange={canChange} rangeQS={rangeQS} basePath={basePath} />

      {historyTitle && (
        <Suspense key={streamKey} fallback={<ChartsSkeleton />}>
          <TrafficHistory traffic={traffic} range={range} title={historyTitle} showBack={!!chosen} allHref={allHref} />
        </Suspense>
      )}
    </div>
  );
}

type SummaryCards = { inBps: number | null; outBps: number | null; capacityBps: number | null; capacityLabel: string; statusLabel: string };

async function SummaryGrid({ traffic, bucketSec, chartTitle, cards }: { traffic: Promise<InterfaceBucket[]>; bucketSec: number; chartTitle: string; cards: SummaryCards }) {
  const items = await traffic;
  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <div className="lg:col-span-2">
        <InterfaceSummaryCards {...cards} peakTotalBps={peakTotal(items)} />
      </div>
      <MetricChart
        className="lg:col-span-3"
        title={chartTitle}
        points={trafficPoints(items, "in")}
        second={{ label: "outbound", points: trafficPoints(items, "out") }}
        firstLabel="inbound"
        unit="bps"
        bucketSec={bucketSec}
        fillHeight
      />
    </div>
  );
}

async function TrafficHistory({ traffic, range, title, showBack, allHref }: { traffic: Promise<InterfaceBucket[]>; range: ResolvedRange; title: string; showBack: boolean; allHref: string }) {
  const items = await traffic;
  if (items.length === 0) return null;
  const history = summarizeTraffic(items, range.bucketSec, tableGroupSec(range));
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">{title} — traffic history</p>
        {showBack && (
          <Link href={allHref} className="text-muted-foreground hover:text-foreground text-xs hover:underline">
            ← All ports (aggregate)
          </Link>
        )}
      </div>
      <div className="grid gap-4 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <TrafficVolumeCards summary={history} />
        </div>
        <MetricChart
          className="lg:col-span-3"
          title={`Traffic — ${range.label || "selected range"}`}
          points={trafficPoints(items, "in")}
          second={{ label: "outbound", points: trafficPoints(items, "out") }}
          firstLabel="inbound"
          unit="bps"
          bucketSec={range.bucketSec}
          fillHeight
        />
      </div>
      <TrafficHistoryTable rows={history.rows} labelFormat={tableLabelFormat(range)} />
    </div>
  );
}

function ChartsSkeleton() {
  return (
    <div className="grid gap-4 lg:grid-cols-5" aria-busy="true">
      <div className="bg-muted h-56 animate-pulse rounded-2xl lg:col-span-2" />
      <div className="bg-muted h-56 animate-pulse rounded-2xl lg:col-span-3" />
    </div>
  );
}

async function IncidentsTab({ orgId, id }: { orgId: number; id: number }) {
  const { items } = await IncidentService.list(orgId);
  const mine = items
    .filter((x) => x.device?.id === id)
    .sort((a, b) => new Date(b.incident.triggeredAt).getTime() - new Date(a.incident.triggeredAt).getTime());
  return (
    <DeviceIncidents
      incidents={mine.map(({ incident }) => ({
        id: incident.id,
        severity: incident.severity,
        title: incident.title,
        ruleName: incident.ruleName,
        status: incident.status,
        triggeredAt: incident.triggeredAt,
        resolvedAt: incident.resolvedAt,
      }))}
    />
  );
}

async function SettingsTab({ orgId, id, status, canChange, minPollIntervalSec }: { orgId: number; id: number; status: EngineDeviceStatus; canChange: boolean; minPollIntervalSec: number }) {
  // the map position and group live in our own device row (owner-checked), not in the engine
  const [owned, groups] = await Promise.all([DeviceService.getOwned(orgId, id), DeviceGroupService.listByOrg(orgId)]);

  return (
    <DeviceSettingsForm
      deviceId={id}
      device={status.device}
      latitude={owned.latitude}
      longitude={owned.longitude}
      groupId={owned.groupId}
      groups={groups.map((g) => ({ id: g.id, name: g.name }))}
      minPollIntervalSec={minPollIntervalSec}
      canChange={canChange}
    />
  );
}
