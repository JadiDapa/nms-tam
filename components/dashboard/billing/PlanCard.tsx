import { ReactNode } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatDate, formatIDR } from "@/lib/format";
import { StatusBadge } from "../StatusBadge";

type Props = {
  planName: string;
  status: string;
  live: boolean;
  priceMonthly: number;
  extraSlots: number;
  extraSlotPrice: number;
  monthlyCost: number;
  devicesInUse: number;
  minPollIntervalSec: number;
  period: { start: Date; end: Date };
  // how much of the paid period has passed, 0-100
  elapsedPct: number;
  daysLeft: number;
  // the three request buttons (client dialogs), passed in as ready-made elements
  actions: ReactNode;
  className?: string;
};

const STATUS: Record<string, { label: string; tone: "green" | "red" | "gray" }> = {
  ACTIVE: { label: "ACTIVE", tone: "green" },
  EXPIRED: { label: "EXPIRED", tone: "red" },
  CANCELED: { label: "CANCELED", tone: "gray" },
  NONE: { label: "NO PLAN", tone: "gray" },
};

function Row({ label, value, strong }: { label: string; value: ReactNode; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn("font-mono tabular-nums", strong && "text-base font-medium")}>{value}</dd>
    </div>
  );
}

// The current plan: where the paid period stands, what the monthly price is made of, and the ways to change it.
export default function PlanCard(p: Props) {
  const pct = p.elapsedPct;
  const closing = !p.live || p.daysLeft <= 7;
  const status = STATUS[p.status] ?? STATUS.NONE;

  return (
    <Card className={p.className}>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div className="space-y-1">
          <CardTitle className="text-xl">{p.planName}</CardTitle>
          <CardDescription>
            {p.live ? "Paid until" : "Ended on"} {formatDate(p.period.end)}
          </CardDescription>
        </div>
        <StatusBadge label={status.label} tone={status.tone} className="rounded-[6px]" />
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-4">
        <div className="bg-muted flex-1 space-y-5 rounded-2xl p-4">
          <div className="space-y-2">
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="font-medium">Paid period</span>
              <span className="text-muted-foreground text-xs">
                {formatDate(p.period.start)} → {formatDate(p.period.end)}
              </span>
            </div>
            <div className="bg-foreground/10 h-2 overflow-hidden rounded-full">
              <div className={cn("h-full rounded-full", closing ? "bg-red-500" : "bg-foreground/75")} style={{ width: `${Math.max(pct, 2)}%` }} />
            </div>
            <p className="text-muted-foreground text-xs">
              {p.live ? `${Math.max(0, p.daysLeft)} day${p.daysLeft === 1 ? "" : "s"} left · ${pct}% of the period used` : "The period has ended. Request a renewal to keep making changes."}
            </p>
          </div>

          <dl className="border-foreground/10 space-y-2.5 border-t pt-4">
            <Row label="Plan price" value={formatIDR(p.priceMonthly)} />
            {p.extraSlots > 0 && (
              <Row label={`Extra slots (${p.extraSlots} × ${formatIDR(p.extraSlotPrice)})`} value={formatIDR(p.extraSlots * p.extraSlotPrice)} />
            )}
            <Row label="Total per month" value={formatIDR(p.monthlyCost)} strong />
            {p.devicesInUse > 0 && <Row label="Cost per device" value={formatIDR(Math.round(p.monthlyCost / p.devicesInUse))} />}
            <Row label="Fastest polling" value={`every ${p.minPollIntervalSec} s`} />
          </dl>
        </div>

        <div className="flex flex-wrap gap-2">{p.actions}</div>
      </CardContent>
    </Card>
  );
}
