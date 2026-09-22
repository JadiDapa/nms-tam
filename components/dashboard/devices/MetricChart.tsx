"use client";

import { useId } from "react";
import { format } from "date-fns";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { cn } from "@/lib/utils";
import { formatBps } from "@/lib/format";

export type ChartPoint = { t: number; avg: number | null; max: number | null };

type Props = {
  title: string;
  points: ChartPoint[];
  // how values are written on the axis and in the tooltip (a name, not a function: functions cannot be passed from the server)
  unit: "pct" | "ms" | "bps";
  // draw the peak line as well as the average (traffic and latency spikes matter)
  showMax?: boolean;
  // a second series drawn next to the first (outbound next to inbound)
  second?: { label: string; points: ChartPoint[] };
  firstLabel?: string;
  // bucket size of the points; a gap larger than a couple of buckets is drawn as a gap
  bucketSec: number;
  // height of the plot in px; ignored when fillHeight is set
  height?: number;
  // stretch the chart to the card's full height instead of a fixed px height (for a row next to something taller, e.g. KPI tiles)
  fillHeight?: boolean;
  className?: string;
};

const spanLabel = (points: ChartPoint[]) => {
  if (points.length < 2) return "HH:mm";
  return points[points.length - 1].t - points[0].t > 36 * 3_600_000 ? "dd MMM" : "HH:mm";
};

// Real data only: a gap in the samples stays a gap in the line, it is never filled in.
const FORMATTERS: Record<Props["unit"], (v: number) => string> = {
  pct: (v) => `${v.toFixed(v < 10 ? 1 : 0)}%`,
  ms: (v) => `${v.toFixed(v < 10 ? 1 : 0)} ms`,
  bps: formatBps,
};

const Y_WIDTH: Record<Props["unit"], number> = { pct: 50, ms: 76, bps: 84 };

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

export default function MetricChart({ title, points, unit, showMax, second, firstLabel = "average", bucketSec, height = 200, fillHeight, className }: Props) {
  const gradA = `mc-a-${useId().replace(/:/g, "")}`;
  const gradB = `mc-b-${useId().replace(/:/g, "")}`;

  const merged = new Map<number, Record<string, number | null>>();
  for (const p of points) merged.set(p.t, { t: p.t, a: p.avg, m: p.max, b: null });
  for (const p of second?.points ?? []) {
    const row = merged.get(p.t) ?? { t: p.t, a: null, m: null, b: null };
    row.b = p.avg;
    merged.set(p.t, row);
  }
  const sorted = [...merged.values()].sort((x, y) => (x.t as number) - (y.t as number));
  // no samples for a while (device down, paused, engine stopped): leave a hole instead of joining the two sides
  const data: Array<Record<string, number | null>> = [];
  sorted.forEach((row, i) => {
    data.push(row);
    const next = sorted[i + 1];
    if (next && (next.t as number) - (row.t as number) > bucketSec * 2500) {
      data.push({ t: (row.t as number) + bucketSec * 1000, a: null, m: null, b: null });
    }
  });

  const axisFormat = spanLabel(points);
  const fmt = FORMATTERS[unit];

  // summary chips: what the eye wants to know before reading the chart
  const aVals = points.flatMap((p) => (p.avg === null ? [] : [p.avg]));
  const bVals = (second?.points ?? []).flatMap((p) => (p.avg === null ? [] : [p.avg]));
  const peakVals = points.flatMap((p) => (p.max ?? p.avg) === null ? [] : [(p.max ?? p.avg) as number]);
  const latest = aVals.length ? aVals[aVals.length - 1] : null;
  const chips: { label: string; value: string; color?: string }[] = second
    ? [
        { label: `${firstLabel} avg`, value: aVals.length ? fmt(mean(aVals)!) : "—", color: "var(--chart-1)" },
        { label: `${second.label} avg`, value: bVals.length ? fmt(mean(bVals)!) : "—", color: "var(--chart-2)" },
      ]
    : [
        { label: "now", value: latest === null ? "—" : fmt(latest), color: "var(--chart-1)" },
        { label: "avg", value: aVals.length ? fmt(mean(aVals)!) : "—" },
        { label: "peak", value: peakVals.length ? fmt(Math.max(...peakVals)) : "—" },
      ];

  const config = {
    a: { label: firstLabel, color: "var(--chart-1)" },
    m: { label: "peak", color: "var(--chart-2)" },
    b: { label: second?.label ?? "second", color: "var(--chart-2)" },
  } satisfies ChartConfig;

  return (
    <Card className={cn("gap-3 py-4", fillHeight && "h-full", className)}>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-x-4 gap-y-1 space-y-0 px-5">
        <CardTitle className="text-base">{title}</CardTitle>
        <div className="flex items-center gap-4 text-xs">
          {chips.map((c) => (
            <span key={c.label} className="text-muted-foreground flex items-center gap-1.5">
              {c.color && <span className="size-2 rounded-[2px]" style={{ background: c.color }} />}
              {c.label}
              <span className="text-foreground font-mono font-medium tabular-nums">{c.value}</span>
            </span>
          ))}
        </div>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col px-3">
        <div className={cn("bg-muted flex flex-1 flex-col rounded-2xl p-3", fillHeight && "h-full")}>
          {data.length === 0 ? (
            <p className="text-muted-foreground flex flex-1 items-center justify-center py-10 text-sm" style={{ minHeight: height }}>
              No data in this period.
            </p>
          ) : (
            <ChartContainer
              config={config}
              className={cn("aspect-auto w-full", fillHeight && "h-full")}
              style={fillHeight ? undefined : { height }}
            >
              <AreaChart data={data} margin={{ top: 6, right: 4, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id={gradA} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-a)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--color-a)" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id={gradB} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-b)" stopOpacity={0.1} />
                    <stop offset="100%" stopColor="var(--color-b)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} strokeDasharray="4 4" />
                <XAxis
                  dataKey="t"
                  type="number"
                  scale="time"
                  domain={["dataMin", "dataMax"]}
                  tickFormatter={(t: number) => format(new Date(t), axisFormat)}
                  tickLine={false}
                  axisLine={false}
                  tickMargin={6}
                  minTickGap={36}
                />
                <YAxis width={Y_WIDTH[unit]} tickLine={false} axisLine={false} tickCount={4} domain={[0, "auto"]} tickFormatter={(v: number) => fmt(v)} />
                <ChartTooltip
                  cursor={false}
                  content={
                    <ChartTooltipContent
                      hideIndicator
                      labelFormatter={(_, payload) => {
                        const t = (payload?.[0]?.payload as { t?: number } | undefined)?.t;
                        return t ? format(new Date(t), "dd MMM HH:mm") : "";
                      }}
                      formatter={(value, name, item) => {
                        if (value === null || value === undefined) return null;
                        const label = config[name as keyof typeof config]?.label ?? String(name);
                        return (
                          <div className="flex w-full min-w-32 items-center justify-between gap-4">
                            <span className="text-muted-foreground flex items-center gap-1.5">
                              <span className="size-2 rounded-[2px]" style={{ background: item.color }} />
                              {label}
                            </span>
                            <span className="font-mono font-medium tabular-nums">{fmt(Number(value))}</span>
                          </div>
                        );
                      }}
                    />
                  }
                />
                {second && (
                  <Area dataKey="b" type="monotone" stroke="var(--color-b)" strokeWidth={2} fill={`url(#${gradB})`} connectNulls={false} isAnimationActive={false} />
                )}
                <Area dataKey="a" type="monotone" stroke="var(--color-a)" strokeWidth={2} fill={`url(#${gradA})`} connectNulls={false} isAnimationActive={false} />
                {showMax && (
                  <Area dataKey="m" type="monotone" stroke="var(--color-m)" strokeWidth={1} strokeDasharray="4 3" strokeOpacity={0.7} fill="none" connectNulls={false} isAnimationActive={false} />
                )}
              </AreaChart>
            </ChartContainer>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
