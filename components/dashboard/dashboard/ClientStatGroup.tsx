import { AlertTriangle, CheckCircle2, Server, XCircle } from "lucide-react";
import { StatCard, StatGroup } from "../StatCard";
import type { DeviceMonitorService } from "@/servers/services/device-monitor.service";

type Rows = Awaited<ReturnType<typeof DeviceMonitorService.fleet>>["rows"];

type Props = {
  rows: Rows;
  deviceLimit: number;
  activeIncidents: number;
  className?: string;
};

// The four summary tiles (devices, up, down, active incidents), shared by the dashboard and the Devices page.
export default function ClientStatGroup({ rows, deviceLimit, activeIncidents, className }: Props) {
  const running = rows.filter((r) => r.device.status === "ACTIVE");
  const up = running.filter((r) => r.fleet?.reachability === "UP").length;
  const down = running.filter((r) => r.fleet?.reachability === "DOWN").length;
  const other = running.length - up - down;
  const paused = rows.length - running.length;

  const slotPct = deviceLimit > 0 ? Math.round((rows.length / deviceLimit) * 100) : 0;
  const upPct = running.length > 0 ? Math.round((up / running.length) * 100) : null;

  const cards = [
    {
      label: "Devices",
      value: `${rows.length}`,
      pill: { label: `${slotPct}% used`, tone: (slotPct >= 90 ? "yellow" : "green") as "yellow" | "green" },
      caption: `of ${deviceLimit} slots`,
      icon: Server,
      featured: true,
    },
    {
      label: "Up",
      value: up,
      pill:
        upPct === null
          ? undefined
          : { label: `${upPct}%`, tone: (upPct === 100 ? "green" : "yellow") as "yellow" | "green", arrow: "up" as const },
      caption: other > 0 ? `${other} degraded or unknown` : "of running devices",
      icon: CheckCircle2,
    },
    {
      label: "Down",
      value: down,
      pill:
        down > 0
          ? { label: "Needs attention", tone: "red" as const, arrow: "down" as const }
          : { label: "All reachable", tone: "green" as const },
      caption: paused > 0 ? `${paused} paused` : "right now",
      icon: XCircle,
    },
    {
      label: "Active incidents",
      value: activeIncidents,
      pill: activeIncidents > 0 ? { label: "Open", tone: "red" as const } : { label: "All clear", tone: "green" as const },
      caption: "right now",
      icon: AlertTriangle,
    },
  ];

  return (
    <StatGroup className={className}>
      {cards.map((c) => (
        <StatCard key={c.label} {...c} />
      ))}
    </StatGroup>
  );
}
