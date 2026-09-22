import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { RibbonSegment, RibbonState } from "@/lib/availability";

const COLOR: Record<RibbonState, string> = {
  up: "bg-green-500",
  warning: "bg-amber-500",
  down: "bg-red-500",
  unknown: "bg-foreground/10",
};

const LABEL: Record<RibbonState, string> = {
  up: "Up",
  warning: "Degraded / recovering",
  down: "Down",
  unknown: "No data",
};

type Props = {
  segments: RibbonSegment[];
  availabilityPct: number | null;
  hours: number;
  className?: string;
};

// A status-page style strip of the last day: one slice per half hour, coloured by what the device was doing.
export default function UptimeRibbon({ segments, availabilityPct, hours, className }: Props) {
  const shown = availabilityPct === null ? "—" : availabilityPct >= 99.95 ? "100%" : `${availabilityPct.toFixed(availabilityPct >= 99 ? 2 : 1)}%`;
  const downSlices = segments.filter((s) => s.state === "down").length;

  return (
    <Card className={cn("gap-3 py-4", className)}>
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0 px-5">
        <CardTitle className="text-base">Availability</CardTitle>
        <span className="text-muted-foreground text-xs">last {hours} hours</span>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col px-3">
        <div className="bg-muted flex flex-1 flex-col justify-center gap-3 rounded-2xl p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <p className="font-mono text-3xl leading-none font-medium tracking-tight tabular-nums">{shown}</p>
            <p className="text-muted-foreground text-xs">
              {availabilityPct === null
                ? "Not enough history yet"
                : downSlices === 0
                  ? "reachable the whole time we watched"
                  : `reachable · ${downSlices} down slice${downSlices === 1 ? "" : "s"}`}
            </p>
          </div>

          <div className="flex h-9 items-stretch gap-[2px]" role="img" aria-label={`Availability ${shown}`}>
            {segments.map((s) => (
              <span
                key={s.start}
                title={`${format(new Date(s.start), "dd MMM HH:mm")} – ${format(new Date(s.end), "HH:mm")} · ${LABEL[s.state]}`}
                className={cn("flex-1 rounded-[3px] transition-opacity hover:opacity-60", COLOR[s.state])}
              />
            ))}
          </div>

          <div className="text-muted-foreground flex items-center justify-between text-[11px]">
            <span>{hours}h ago</span>
            <span className="flex items-center gap-3">
              {(["up", "warning", "down", "unknown"] as RibbonState[]).map((k) => (
                <span key={k} className="flex items-center gap-1">
                  <span className={cn("size-2 rounded-[2px]", COLOR[k])} />
                  {k === "warning" ? "degraded" : k === "unknown" ? "no data" : k}
                </span>
              ))}
            </span>
            <span>now</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
