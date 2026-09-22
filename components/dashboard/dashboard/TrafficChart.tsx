"use client";

import { useId } from "react";
import { format } from "date-fns";
import { Area, AreaChart, CartesianGrid, ReferenceLine, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { cn } from "@/lib/utils";
import { formatBps } from "@/lib/format";

export type TrafficSlot = { t: number; bps: number | null };

const config = { bps: { label: "Traffic", color: "var(--chart-1)" } } satisfies ChartConfig;

// Colours of the three reference lines; each matches the dot in the summary above the chart.
const STATS = {
  max: { label: "Max", color: "var(--chart-5)" },
  avg: { label: "Avg", color: "var(--chart-2)" },
  min: { label: "Min", color: "var(--chart-3)" },
} as const;

type StatKey = keyof typeof STATS;
const STAT_KEYS = Object.keys(STATS) as StatKey[];

type Props = {
  slots: TrafficSlot[];
  interfaceCount: number;
  // a short version (one line of header, low chart) for pages that stack several charts
  compact?: boolean;
  className?: string;
};

// Total traffic (in + out) of the client's monitored physical interfaces in 5-minute slots over the last hour.
export default function TrafficChart({ slots, interfaceCount, compact = false, className }: Props) {
  const gradientId = `traffic-${useId().replace(/:/g, "")}`;
  const values = slots.flatMap((s) => (s.bps === null ? [] : [s.bps]));
  const stats: Record<StatKey, number> | null =
    values.length > 0
      ? { max: Math.max(...values), avg: values.reduce((a, b) => a + b, 0) / values.length, min: Math.min(...values) }
      : null;
  const data = slots.map((s) => ({ ...s, label: format(new Date(s.t), "HH:mm") }));
  const interfacesText = `${interfaceCount} ${interfaceCount === 1 ? "interface" : "interfaces"}`;

  // Max / Avg / Min with the colour of their line on the chart
  const statChips = stats && (
    <div className="flex items-center gap-4 text-xs">
      {STAT_KEYS.map((k) => (
        <span key={k} className="text-muted-foreground flex items-center gap-1.5">
          <span className="size-2 rounded-[2px]" style={{ background: STATS[k].color }} />
          {STATS[k].label}
          <span className="text-foreground font-medium">{formatBps(stats[k])}</span>
        </span>
      ))}
    </div>
  );

  return (
    <Card className={cn(compact && "gap-3 py-4", className)}>
      {compact ? (
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-x-4 gap-y-1 space-y-0 px-5">
          <CardTitle className="text-base">
            Traffic <span className="text-muted-foreground text-xs font-normal">· {interfacesText}</span>
          </CardTitle>
          {statChips}
        </CardHeader>
      ) : (
        <CardHeader>
          <CardTitle className="text-xl">Traffic</CardTitle>
          <CardDescription>Total in + out traffic of your monitored interfaces, every 5 minutes for the last hour</CardDescription>
        </CardHeader>
      )}
      <CardContent className={cn("flex min-h-0 flex-1 flex-col", compact && "px-3")}>
        <div className={cn("bg-muted flex flex-1 flex-col rounded-2xl", compact ? "p-3" : "gap-3 p-4")}>
          {!compact && (
            <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
              <p className="text-sm font-medium">
                Throughput <span className="text-muted-foreground font-normal">· {interfacesText}</span>
              </p>
              {statChips}
            </div>
          )}

          {!stats ? (
            <p className={cn("text-muted-foreground flex flex-1 items-center justify-center text-center text-sm", compact ? "py-8" : "py-16")}>
              No traffic readings in the last hour. Traffic appears once a physical interface is monitored on a running device.
            </p>
          ) : (
            <ChartContainer config={config} className={cn("aspect-auto w-full", compact ? "h-[116px]" : "h-[280px]")}>
              <AreaChart data={data} margin={{ top: compact ? 4 : 8, right: 4, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--color-bps)" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="var(--color-bps)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} strokeDasharray="4 4" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={compact ? 4 : 8} interval="preserveStartEnd" minTickGap={16} />
                <YAxis
                  width={compact ? 74 : 76}
                  tickLine={false}
                  axisLine={false}
                  tickCount={compact ? 3 : undefined}
                  domain={[0, (dataMax: number) => dataMax * 1.15]}
                  tickFormatter={(v: number) => formatBps(v)}
                />
                {STAT_KEYS.map((k) => (
                  <ReferenceLine key={k} y={stats[k]} stroke={STATS[k].color} strokeDasharray="5 4" strokeOpacity={0.85} />
                ))}
                <ChartTooltip
                  cursor={false}
                  content={
                    <ChartTooltipContent
                      hideIndicator
                      labelFormatter={(_, payload) => {
                        const t = (payload?.[0]?.payload as TrafficSlot | undefined)?.t;
                        return t ? `${format(new Date(t), "HH:mm")} – ${format(new Date(t + 300_000), "HH:mm")}` : "";
                      }}
                      formatter={(value) => (
                        <div className="flex w-full min-w-36 justify-between gap-4">
                          <span className="text-muted-foreground">Traffic</span>
                          <span className="font-medium">{formatBps(Number(value))}</span>
                        </div>
                      )}
                    />
                  }
                />
                <Area
                  dataKey="bps"
                  type="monotone"
                  stroke="var(--color-bps)"
                  strokeWidth={compact ? 2 : 2.5}
                  fill={`url(#${gradientId})`}
                  connectNulls={false}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ChartContainer>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
