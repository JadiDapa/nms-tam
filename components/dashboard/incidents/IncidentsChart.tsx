"use client";

import { format } from "date-fns";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import type { DayBucket } from "@/lib/incident-stats";
import { SEVERITY_STYLE } from "./severity";

const config = {
  critical: { label: "Critical", color: SEVERITY_STYLE.critical.color },
  warning: { label: "Warning", color: SEVERITY_STYLE.warning.color },
  info: { label: "Info", color: SEVERITY_STYLE.info.color },
} satisfies ChartConfig;

// New incidents per day, stacked by severity.
export default function IncidentsChart({ days, className }: { days: DayBucket[]; className?: string }) {
  const totals = {
    critical: days.reduce((s, d) => s + d.critical, 0),
    warning: days.reduce((s, d) => s + d.warning, 0),
    info: days.reduce((s, d) => s + d.info, 0),
  };
  const all = totals.critical + totals.warning + totals.info;

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-xl">Activity</CardTitle>
        <CardDescription>New incidents per day over the last {days.length} days</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col">
        <div className="bg-muted flex flex-1 flex-col gap-3 rounded-2xl p-4">
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1">
            <p className="text-sm font-medium">
              <span className="font-mono tabular-nums">{all}</span> <span className="text-muted-foreground font-normal">started</span>
            </p>
            <div className="flex items-center gap-4 text-xs">
              {(["critical", "warning", "info"] as const).map((k) => (
                <span key={k} className="text-muted-foreground flex items-center gap-1.5">
                  <span className="size-2 rounded-[2px]" style={{ background: SEVERITY_STYLE[k].color }} />
                  {SEVERITY_STYLE[k].label}
                  <span className="text-foreground font-mono font-medium tabular-nums">{totals[k]}</span>
                </span>
              ))}
            </div>
          </div>

          {all === 0 ? (
            <p className="text-muted-foreground flex flex-1 items-center justify-center py-16 text-sm">No incidents in this period.</p>
          ) : (
            <ChartContainer config={config} className="aspect-auto h-[250px] w-full">
              <BarChart data={days} margin={{ top: 8, right: 4, bottom: 0, left: 0 }} barCategoryGap="18%">
                <CartesianGrid vertical={false} strokeDasharray="4 4" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} interval="preserveStartEnd" minTickGap={28} />
                <YAxis width={28} tickLine={false} axisLine={false} allowDecimals={false} tickCount={4} />
                <ChartTooltip
                  cursor={false}
                  content={
                    <ChartTooltipContent
                      indicator="dot"
                      labelFormatter={(_, payload) => {
                        const key = (payload?.[0]?.payload as DayBucket | undefined)?.key;
                        return key ? format(new Date(`${key}T12:00:00`), "EEEE, dd MMM") : "";
                      }}
                    />
                  }
                />
                <Bar dataKey="info" stackId="s" fill="var(--color-info)" radius={[3, 3, 0, 0]} isAnimationActive={false} />
                <Bar dataKey="warning" stackId="s" fill="var(--color-warning)" radius={[3, 3, 0, 0]} isAnimationActive={false} />
                <Bar dataKey="critical" stackId="s" fill="var(--color-critical)" radius={[3, 3, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ChartContainer>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
