import Link from "next/link";
import { CircleHelp, Network, Router, Server, ShieldCheck, Waypoints, Wifi, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatBps, formatMs, formatPct, timeAgo } from "@/lib/format";
import { STATE_META } from "../map/map-types";
import Sparkline from "./Sparkline";
import { typeLabel, type DeviceItem } from "./device-list-types";

// A thin usage meter. Black while healthy, amber and red as it fills up.
export function Meter({ label, pct }: { label: string; pct: number | null }) {
  const tone = pct === null ? "" : pct >= 90 ? "bg-red-500" : pct >= 75 ? "bg-amber-500" : "bg-foreground/75";
  return (
    <div className="flex items-center gap-2.5">
      {label && <span className="text-muted-foreground w-9 text-xs">{label}</span>}
      <div className="bg-foreground/10 h-1.5 flex-1 overflow-hidden rounded-full">
        {pct !== null && <div className={cn("h-full rounded-full", tone)} style={{ width: `${Math.min(100, Math.max(pct, 2))}%` }} />}
      </div>
      <span className="w-10 text-right font-mono text-xs tabular-nums">{formatPct(pct)}</span>
    </div>
  );
}

// The status dot with a soft halo of the same colour. It is the card's only status marker, so it carries a label.
export function Beacon({ state }: { state: DeviceItem["state"] }) {
  const color = STATE_META[state].color;
  return (
    <span
      role="img"
      aria-label={STATE_META[state].label}
      title={STATE_META[state].label}
      className="block size-2.5 shrink-0 rounded-full"
      style={{ background: color, boxShadow: `0 0 0 4px ${color}33` }}
    />
  );
}

export const TYPE_ICON: Record<string, LucideIcon> = {
  router: Router,
  switch: Network,
  firewall: ShieldCheck,
  server: Server,
  access_point: Wifi,
  gateway: Waypoints,
};

const tag = "bg-card text-muted-foreground rounded-[6px] px-1.5 py-0.5 text-[11px] font-medium";

export default function DeviceCard({ device: d }: { device: DeviceItem }) {
  const paused = d.state === "paused";
  const TypeIcon = TYPE_ICON[d.deviceType] ?? CircleHelp;

  return (
    <Link
      href={`/dashboard/devices/${d.id}`}
      className={cn(
        "bg-muted group flex flex-col gap-5 rounded-3xl p-5 transition-all hover:-translate-y-0.5 hover:shadow-md",
        paused && "opacity-70",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-1.5 flex">
            <Beacon state={d.state} />
          </span>
          <div className="min-w-0">
            <p className="truncate text-base leading-tight font-medium">{d.name}</p>
            <p className="text-muted-foreground mt-1 truncate font-mono text-xs">{d.host || "—"}</p>
          </div>
        </div>
        <span className="bg-card text-muted-foreground flex shrink-0 items-center gap-1.5 rounded-[6px] px-2 py-1 text-xs font-medium capitalize">
          <TypeIcon className="size-3.5" />
          {typeLabel(d.deviceType)}
        </span>
      </div>

      <div className="space-y-2.5">
        <Meter label="CPU" pct={paused ? null : d.cpuPct} />
        <Meter label="Mem" pct={paused ? null : d.memoryPct} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="min-w-0">
          <p className="text-muted-foreground text-xs">Latency</p>
          <p className="mt-0.5 font-mono text-xl leading-none tabular-nums">{paused ? "—" : formatMs(d.latencyMs)}</p>
          <Sparkline values={d.latencySeries} className="mt-2" />
        </div>
        <div className="min-w-0">
          <p className="text-muted-foreground text-xs">Traffic now</p>
          <p className="mt-0.5 font-mono text-xl leading-none tabular-nums">{paused ? "—" : formatBps(d.throughputBps)}</p>
          {d.vendor && <p className="text-muted-foreground mt-2 truncate text-xs">{d.vendor}</p>}
        </div>
      </div>

      <div className="border-foreground/10 mt-auto flex items-center justify-between gap-2 border-t pt-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {d.icmp && <span className={tag}>ICMP</span>}
          {d.snmp && (
            <span className={d.snmpHealth === "DOWN" ? "rounded-[6px] bg-red-500/10 px-1.5 py-0.5 text-[11px] font-medium text-red-600 dark:text-red-500" : tag}>SNMP</span>
          )}
          {d.tcpPorts > 0 && <span className={tag}>TCP {d.tcpPorts}</span>}
          {d.incidents > 0 && (
            <span className="rounded-[6px] bg-red-500/10 px-1.5 py-0.5 text-[11px] font-medium text-red-600 dark:text-red-500">
              {d.incidents} incident{d.incidents === 1 ? "" : "s"}
            </span>
          )}
        </div>
        {/* relative time differs between the server render and hydration by design */}
        <span suppressHydrationWarning className="text-muted-foreground shrink-0 text-xs">
          {paused ? d.health.toLowerCase() : timeAgo(d.lastPollAt)}
        </span>
      </div>
    </Link>
  );
}
