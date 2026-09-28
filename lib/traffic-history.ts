import type { InterfaceBucket } from "@/servers/engine/engine-types";
import type { ResolvedRange } from "@/lib/date-range";

export type HistoryRow = { t: number; inBps: number | null; outBps: number | null; peakBps: number | null; volumeBytes: number };

export type TrafficSummary = {
  inBytes: number;
  outBytes: number;
  totalBytes: number;
  peakInBps: number | null;
  peakOutBps: number | null;
  peakTotalBps: number | null;
  avgTotalBps: number | null;
  rows: HistoryRow[];
};

// How the history log's rows are grouped, and how their time column reads — coarser as the selected window widens,
// so a custom multi-week range does not produce thousands of one-row-per-minute entries.
export function tableGroupSec(range: ResolvedRange): number {
  const spanMs = range.to.getTime() - range.from.getTime();
  const HOUR = 3_600_000;
  const DAY = 86_400_000;
  if (spanMs <= 6 * HOUR) return 300;
  if (spanMs <= DAY) return 1_800;
  if (spanMs <= 7 * DAY) return 3_600;
  return 86_400;
}

export function tableLabelFormat(range: ResolvedRange): string {
  return tableGroupSec(range) < 86_400 ? "HH:mm" : "dd MMM";
}

// Turns per-bucket average rates into a data-volume summary: bytes transferred (rate x bucket width, integrated),
// peaks, and a coarser log. A bucket with no sample (both averages null) is skipped, never treated as zero.
export function summarizeTraffic(buckets: InterfaceBucket[], fetchBucketSec: number, tableBucketSec: number): TrafficSummary {
  let inBytes = 0;
  let outBytes = 0;
  let peakInBps: number | null = null;
  let peakOutBps: number | null = null;
  let peakTotalBps: number | null = null;
  let totalSum = 0;
  let totalCount = 0;

  const groups = new Map<number, { inSum: number; outSum: number; peak: number; count: number; volumeBytes: number }>();

  for (const b of buckets) {
    if (b.inBpsAvg === null && b.outBpsAvg === null) continue;
    const inVal = b.inBpsAvg ?? 0;
    const outVal = b.outBpsAvg ?? 0;
    const totalVal = inVal + outVal;

    inBytes += (inVal / 8) * fetchBucketSec;
    outBytes += (outVal / 8) * fetchBucketSec;
    peakInBps = peakInBps === null ? (b.inBpsMax ?? inVal) : Math.max(peakInBps, b.inBpsMax ?? inVal);
    peakOutBps = peakOutBps === null ? (b.outBpsMax ?? outVal) : Math.max(peakOutBps, b.outBpsMax ?? outVal);
    peakTotalBps = peakTotalBps === null ? totalVal : Math.max(peakTotalBps, totalVal);
    totalSum += totalVal;
    totalCount += 1;

    const key = Math.floor(new Date(b.time).getTime() / (tableBucketSec * 1000));
    const g = groups.get(key) ?? { inSum: 0, outSum: 0, peak: 0, count: 0, volumeBytes: 0 };
    g.inSum += inVal;
    g.outSum += outVal;
    g.peak = Math.max(g.peak, totalVal);
    g.count += 1;
    g.volumeBytes += (totalVal / 8) * fetchBucketSec;
    groups.set(key, g);
  }

  const rows: HistoryRow[] = [...groups.entries()]
    .sort(([a], [b]) => a - b)
    .map(([key, g]) => ({
      t: key * tableBucketSec * 1000,
      inBps: g.count ? g.inSum / g.count : null,
      outBps: g.count ? g.outSum / g.count : null,
      peakBps: g.count ? g.peak : null,
      volumeBytes: g.volumeBytes,
    }));

  return {
    inBytes,
    outBytes,
    totalBytes: inBytes + outBytes,
    peakInBps,
    peakOutBps,
    peakTotalBps,
    avgTotalBps: totalCount ? totalSum / totalCount : null,
    rows,
  };
}
