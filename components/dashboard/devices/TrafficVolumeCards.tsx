import { ArrowDown, ArrowUp, Database, TrendingUp } from "lucide-react";
import { StatCard, StatGroup } from "../StatCard";
import { formatBps, formatBytes } from "@/lib/format";
import type { TrafficSummary } from "@/lib/traffic-history";

type Props = { summary: TrafficSummary };

// The four KPI tiles for a traffic-history period: bytes in/out/total and the highest single sample.
// Caption-only (no pills), matching InterfaceSummaryCards, so both rows of the 2x2 grid come out the same height.
export default function TrafficVolumeCards({ summary }: Props) {
  const { inBytes, outBytes, totalBytes, peakInBps, peakOutBps, peakTotalBps, avgTotalBps } = summary;

  return (
    <StatGroup>
      <StatCard label="Total inbound" value={formatBytes(inBytes)} icon={ArrowDown} caption={`peak ${formatBps(peakInBps)}`} size="md" />
      <StatCard label="Total outbound" value={formatBytes(outBytes)} icon={ArrowUp} caption={`peak ${formatBps(peakOutBps)}`} size="md" />
      <StatCard
        label="Total transferred"
        value={formatBytes(totalBytes)}
        icon={Database}
        caption={avgTotalBps === null ? "no data" : `avg ${formatBps(avgTotalBps)}`}
        size="md"
      />
      <StatCard label="Peak traffic" value={formatBps(peakTotalBps)} icon={TrendingUp} caption="highest single sample" size="md" />
    </StatGroup>
  );
}
