import { ReactNode } from "react";
import { Cpu, MemoryStick, PackageX, Timer, type LucideIcon } from "lucide-react";
import { StatGroup } from "../StatCard";
import { StatusBadge } from "../StatusBadge";
import Sparkline from "../dashboard/Sparkline";
import MetricChart, { type ChartPoint } from "./MetricChart";
import ChangeFeed from "./ChangeFeed";
import HealthPanel from "./HealthPanel";
import RingGauge from "./RingGauge";
import SpecSheet from "./SpecSheet";
import UptimeRibbon from "./UptimeRibbon";
import { formatMs, formatPct } from "@/lib/format";
import type { RibbonSegment } from "@/lib/availability";
import type { EngineDeviceStatus } from "@/servers/engine/engine-types";

type Tone = "green" | "yellow" | "red";

type Props = {
  status: EngineDeviceStatus;
  paused: boolean;
  latencyPoints: ChartPoint[];
  latencySeries: (number | null)[];
  lossSeries: (number | null)[];
  ribbon: { segments: RibbonSegment[]; availabilityPct: number | null };
};

const latest = (status: EngineDeviceStatus, metric: string) => {
  const m = status.latestMetrics.find((x) => x.metric === metric && x.dimension === null);
  return m && m.status === "ok" ? m.value : null;
};

const usageTone = (v: number): { label: string; tone: Tone } =>
  v >= 90 ? { label: "Critical", tone: "red" } : v >= 75 ? { label: "High", tone: "yellow" } : { label: "Normal", tone: "green" };

// The same tile as the dashboard's stat tiles (light gray inside the panel), with room for a gauge or a trend line.
function Tile({ label, icon: Icon, children }: { label: string; icon: LucideIcon; children: ReactNode }) {
  return (
    <div data-slot="stat-card" className="bg-card in-data-[slot=stat-group]:bg-muted flex min-w-0 flex-col justify-between gap-4 rounded-3xl p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-foreground/80 text-base leading-snug font-medium">{label}</p>
        <span className="bg-background text-foreground/80 in-data-[slot=stat-group]:bg-card flex size-10 shrink-0 items-center justify-center rounded-[12px] border">
          <Icon className="size-5" />
        </span>
      </div>
      {children}
    </div>
  );
}

function GaugeTile({ label, icon, value, caption, paused }: { label: string; icon: LucideIcon; value: number | null; caption: string; paused: boolean }) {
  const shown = paused ? null : value;
  const verdict = shown === null ? null : usageTone(shown);
  return (
    <Tile label={label} icon={icon}>
      <div className="flex items-end justify-between gap-3">
        <RingGauge value={shown} size={104}>
          <span className="font-mono text-xl font-medium tabular-nums">{shown === null ? "—" : formatPct(shown)}</span>
        </RingGauge>
        <div className="flex min-w-0 flex-col items-end gap-2 text-right">
          {verdict && <StatusBadge label={verdict.label} tone={verdict.tone} />}
          <span className="text-muted-foreground text-xs">{shown === null ? "no reading" : caption}</span>
        </div>
      </div>
    </Tile>
  );
}

function TrendTile({ label, icon, value, series, pill, caption }: { label: string; icon: LucideIcon; value: string; series: (number | null)[]; pill: { label: string; tone: Tone } | null; caption: string }) {
  return (
    <Tile label={label} icon={icon}>
      <div className="space-y-3">
        <p className="font-mono text-3xl leading-none font-medium tracking-tight tabular-nums">{value}</p>
        <Sparkline values={series} className="h-8" />
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {pill && <StatusBadge label={pill.label} tone={pill.tone} />}
          <span className="text-muted-foreground text-xs">{caption}</span>
        </div>
      </div>
    </Tile>
  );
}

export default function DeviceOverview({ status, paused, latencyPoints, latencySeries, lossSeries, ribbon }: Props) {
  const { device } = status;
  const cpu = latest(status, "cpu_pct");
  const memory = latest(status, "memory_pct");
  const latency = paused ? null : latest(status, "icmp_latency_ms");
  const loss = paused ? null : latest(status, "icmp_packet_loss_pct");

  const latencyPill: { label: string; tone: Tone } | null =
    latency === null ? null : latency > 200 ? { label: "Slow", tone: "red" } : latency > 100 ? { label: "Elevated", tone: "yellow" } : { label: "Fast", tone: "green" };
  const lossPill: { label: string; tone: Tone } | null =
    loss === null ? null : loss === 0 ? { label: "None", tone: "green" } : loss <= 2 ? { label: "Minor", tone: "yellow" } : { label: "High", tone: "red" };


  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-5">
        <StatGroup className="lg:col-span-2">
          <GaugeTile label="CPU" icon={Cpu} value={cpu} caption="processor load" paused={paused} />
          <GaugeTile label="Memory" icon={MemoryStick} value={memory} caption="in use" paused={paused} />
          <TrendTile label="Latency" icon={Timer} value={latency === null ? "—" : formatMs(latency)} series={latencySeries} pill={latencyPill} caption="last hour" />
          <TrendTile label="Packet loss" icon={PackageX} value={loss === null ? "—" : formatPct(loss)} series={lossSeries} pill={lossPill} caption="last hour" />
        </StatGroup>

        <div className="flex flex-col gap-4 lg:col-span-3">
          <UptimeRibbon className="flex-1" segments={ribbon.segments} availabilityPct={ribbon.availabilityPct} hours={24} />
          <MetricChart className="flex-1" title="Latency, last hour" points={latencyPoints} unit="ms" showMax bucketSec={30} height={104} />
        </div>
      </div>

      <HealthPanel status={status} />

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <SpecSheet device={device} />
        </div>
        <div className="lg:col-span-3">
          <ChangeFeed changes={status.stateHistory} />
        </div>
      </div>
    </div>
  );
}
