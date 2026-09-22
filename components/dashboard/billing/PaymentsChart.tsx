"use client";

import { useId } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { cn } from "@/lib/utils";
import { formatIDR, formatIDRCompact } from "@/lib/format";
import type { MonthTotal } from "@/servers/billing/payment-stats";

const config = { total: { label: "Paid", color: "var(--chart-1)" } } satisfies ChartConfig;

// What the client paid, month by month.
export default function PaymentsChart({ months, className }: { months: MonthTotal[]; className?: string }) {
  const hatchId = `hatch-${useId().replace(/:/g, "")}`;
  const total = months.reduce((s, m) => s + m.total, 0);
  const count = months.reduce((s, m) => s + m.count, 0);

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-xl">Payments</CardTitle>
        <CardDescription>Money received from you, per month, over the last {months.length} months</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col">
        <div className="bg-muted flex flex-1 flex-col gap-3 rounded-2xl p-4">
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1">
            <p className="text-sm font-medium">Paid per month</p>
            <span className="text-muted-foreground text-xs">
              <span className="text-foreground font-mono font-medium tabular-nums">{formatIDR(total)}</span> · {count} payment{count === 1 ? "" : "s"}
            </span>
          </div>

          {count === 0 ? (
            <p className={cn("text-muted-foreground flex flex-1 items-center justify-center py-16 text-sm")}>No payments in this period.</p>
          ) : (
            <ChartContainer config={config} className="aspect-auto h-[220px] w-full">
              <BarChart data={months} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
                <defs>
                  <pattern id={hatchId} width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                    <rect width="7" height="7" fill="var(--color-total)" />
                    <line x1="0" y1="0" x2="0" y2="7" stroke="white" strokeOpacity="0.35" strokeWidth="3" />
                  </pattern>
                </defs>
                <CartesianGrid vertical={false} strokeDasharray="4 4" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
                <YAxis width={92} tickLine={false} axisLine={false} tickCount={4} tickFormatter={(v: number) => formatIDRCompact(v)} />
                <ChartTooltip
                  cursor={false}
                  content={
                    <ChartTooltipContent
                      hideIndicator
                      labelFormatter={(_, payload) => {
                        const m = payload?.[0]?.payload as MonthTotal | undefined;
                        return m ? `${m.label} ${m.key.slice(0, 4)}` : "";
                      }}
                      formatter={(value, _, item) => {
                        const m = item.payload as MonthTotal;
                        return (
                          <div className="flex w-full min-w-36 justify-between gap-4">
                            <span className="text-muted-foreground">
                              {m.count} payment{m.count === 1 ? "" : "s"}
                            </span>
                            <span className="font-medium">{formatIDR(Number(value))}</span>
                          </div>
                        );
                      }}
                    />
                  }
                />
                <Bar dataKey="total" fill={`url(#${hatchId})`} radius={[10, 10, 0, 0]} maxBarSize={44} isAnimationActive={false} />
              </BarChart>
            </ChartContainer>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
