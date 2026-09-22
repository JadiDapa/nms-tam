"use client";

import { useId } from "react";
import { format } from "date-fns";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { cn } from "@/lib/utils";
import { formatMs } from "@/lib/format";

export type LatencySlot = { t: number; avg: number | null; devices: { name: string; avg: number }[] };

const config = { avg: { label: "Average latency", color: "var(--chart-1)" } } satisfies ChartConfig;

const MAX_LISTED = 6;

type Props = {
  slots: LatencySlot[];
  deviceCount: number;
  // a short version (one line of header, low chart) for pages that stack several charts
  compact?: boolean;
  className?: string;
};

// Average ping latency of the client's devices in 5-minute slots over the last hour.
export default function LatencyChart({ slots, deviceCount, compact = false, className }: Props) {
  const hatchId = `hatch-${useId().replace(/:/g, "")}`;
  const hasData = slots.some((s) => s.avg !== null);
  const data = slots.map((s) => ({ ...s, label: format(new Date(s.t), "HH:mm") }));
  const devicesText = `${deviceCount} ${deviceCount === 1 ? "device" : "devices"}`;

  return (
    <Card className={cn(compact && "gap-3 py-4", className)}>
      {compact ? (
        <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0 px-5">
          <CardTitle className="text-base">Latency</CardTitle>
          <span className="text-muted-foreground text-xs">
            average per 5 min · {devicesText}
          </span>
        </CardHeader>
      ) : (
        <CardHeader>
          <CardTitle className="text-xl">Latency</CardTitle>
          <CardDescription>Average response time of your devices, every 5 minutes for the last hour</CardDescription>
        </CardHeader>
      )}
      <CardContent className={cn("flex min-h-0 flex-1 flex-col", compact && "px-3")}>
        <div className={cn("bg-muted flex flex-1 flex-col rounded-2xl", compact ? "p-3" : "gap-3 p-4")}>
          {!compact && (
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium">Average latency</p>
              <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
                <span className="bg-primary size-2 rounded-[2px]" />
                {devicesText}
              </span>
            </div>
          )}

          {!hasData ? (
            <p className={cn("text-muted-foreground flex flex-1 items-center justify-center text-sm", compact ? "py-8" : "py-16")}>
              No latency readings in the last hour.
            </p>
          ) : (
            <ChartContainer config={config} className={cn("aspect-auto w-full", compact ? "h-[116px]" : "h-[250px]")}>
              <BarChart data={data} margin={{ top: compact ? 4 : 8, right: 4, bottom: 0, left: 0 }}>
                <defs>
                  <pattern id={hatchId} width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                    <rect width="7" height="7" fill="var(--color-avg)" />
                    <line x1="0" y1="0" x2="0" y2="7" stroke="white" strokeOpacity="0.35" strokeWidth="3" />
                  </pattern>
                </defs>
                <CartesianGrid vertical={false} strokeDasharray="4 4" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={compact ? 4 : 8} interval="preserveStartEnd" minTickGap={16} />
                <YAxis
                  width={compact ? 52 : 64}
                  tickLine={false}
                  axisLine={false}
                  tickCount={compact ? 3 : undefined}
                  tickFormatter={(v: number) => `${v} ms`}
                />
                <ChartTooltip
                  cursor={false}
                  content={
                    <ChartTooltipContent
                      hideIndicator
                      labelFormatter={(_, payload) => {
                        const t = (payload?.[0]?.payload as LatencySlot | undefined)?.t;
                        return t ? `${format(new Date(t), "HH:mm")} – ${format(new Date(t + 300_000), "HH:mm")}` : "";
                      }}
                      formatter={(_, __, item) => {
                        const slot = item.payload as LatencySlot;
                        return (
                          <div className="grid w-full min-w-40 gap-1">
                            <div className="flex justify-between gap-4 font-medium">
                              <span>Average</span>
                              <span>{formatMs(slot.avg)}</span>
                            </div>
                            {slot.devices.slice(0, MAX_LISTED).map((d) => (
                              <div key={d.name} className="text-muted-foreground flex justify-between gap-4">
                                <span className="max-w-32 truncate">{d.name}</span>
                                <span>{formatMs(d.avg)}</span>
                              </div>
                            ))}
                            {slot.devices.length > MAX_LISTED && (
                              <span className="text-muted-foreground">+{slot.devices.length - MAX_LISTED} more</span>
                            )}
                          </div>
                        );
                      }}
                    />
                  }
                />
                <Bar dataKey="avg" fill={`url(#${hatchId})`} radius={[compact ? 6 : 10, compact ? 6 : 10, 0, 0]} maxBarSize={40} isAnimationActive={false} />
              </BarChart>
            </ChartContainer>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
