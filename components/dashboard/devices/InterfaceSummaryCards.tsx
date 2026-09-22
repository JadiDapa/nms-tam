import { ArrowDown, ArrowDownUp, ArrowUp, Activity } from "lucide-react";
import { StatCard, StatGroup } from "../StatCard";
import { formatBps } from "@/lib/format";

type Props = {
  inBps: number | null;
  outBps: number | null;
  // highest (in + out) seen over the chart's range, for the "peak" caption
  peakTotalBps: number | null;
  // total link capacity behind these bytes (one port's speed, or the sum of several); null when unknown
  capacityBps: number | null;
  capacityLabel: string;
  statusLabel: string;
};

// The four KPI tiles above a traffic chart: RX, TX, combined total (with its peak) and how full the link is.
// Each tile is value + one caption line only (no pill), so all four rows come out the same height.
export default function InterfaceSummaryCards({ inBps, outBps, peakTotalBps, capacityBps, capacityLabel, statusLabel }: Props) {
  const totalBps = inBps === null && outBps === null ? null : (inBps ?? 0) + (outBps ?? 0);
  const pct = totalBps !== null && capacityBps ? Math.min(100, (totalBps / capacityBps) * 100) : null;

  return (
    <StatGroup>
      <StatCard label="Inbound (RX)" value={formatBps(inBps)} icon={ArrowDown} caption="download" size="md" />
      <StatCard label="Outbound (TX)" value={formatBps(outBps)} icon={ArrowUp} caption="upload" size="md" />
      <StatCard
        label="Total bandwidth"
        value={formatBps(totalBps)}
        icon={ArrowDownUp}
        caption={peakTotalBps === null ? "no peak yet" : `peak ${formatBps(peakTotalBps)}`}
        size="md"
      />
      <StatCard
        label="Link utilization"
        value={pct === null ? "—" : `${pct.toFixed(1)}%`}
        icon={Activity}
        caption={`${capacityLabel} · ${statusLabel}`}
        size="md"
      />
    </StatGroup>
  );
}
