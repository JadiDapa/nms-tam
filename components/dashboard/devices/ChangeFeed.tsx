import { format, isToday, isYesterday } from "date-fns";
import { ArrowDownRight, ArrowUpRight, CircleHelp, RefreshCw, TriangleAlert, type LucideIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatDuration, timeAgo } from "@/lib/format";
import { describeChanges, type ChangeEntry, type StateChange } from "@/lib/availability";

const KIND: Record<string, string> = { reachability: "Reachability", snmp: "SNMP" };

const LOOK: Record<string, { icon: LucideIcon; chip: string }> = {
  UP: { icon: ArrowUpRight, chip: "bg-green-500/10 text-green-600 dark:text-green-500" },
  DOWN: { icon: ArrowDownRight, chip: "bg-red-500/10 text-red-600 dark:text-red-500" },
  DEGRADED: { icon: TriangleAlert, chip: "bg-amber-500/10 text-amber-600 dark:text-amber-500" },
  RECOVERING: { icon: RefreshCw, chip: "bg-amber-500/10 text-amber-600 dark:text-amber-500" },
  UNKNOWN: { icon: CircleHelp, chip: "bg-foreground/10 text-muted-foreground" },
};

const WORD: Record<string, string> = { UP: "up", DOWN: "down", DEGRADED: "degraded", RECOVERING: "recovering", UNKNOWN: "unknown" };

// "transient_failure_cleared" -> "Transient failure cleared"
const humanize = (s: string) => s.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());

function headline(c: ChangeEntry) {
  const what = KIND[c.kind] ?? c.kind;
  if (c.to === "DOWN") return `${what} went down`;
  if (c.to === "DEGRADED") return `${what} degraded`;
  if (c.to === "RECOVERING") return `${what} is recovering`;
  if (c.to === "UP") return c.from === "UNKNOWN" ? `${what} first seen up` : `${what} restored`;
  return `${what} state unknown`;
}

function dayLabel(t: number) {
  const d = new Date(t);
  if (isToday(d)) return "Today";
  if (isYesterday(d)) return "Yesterday";
  return format(d, "EEEE, dd MMM");
}

// The state-change log as a feed: grouped by day, each change saying what happened and how long the state before it had lasted.
export default function ChangeFeed({ changes }: { changes: StateChange[] }) {
  const entries = describeChanges(changes);
  const outages = entries.filter((c) => c.to === "DOWN").length;
  const flaps = entries.filter((c) => c.to === "DEGRADED").length;

  const days: { label: string; items: ChangeEntry[] }[] = [];
  for (const c of entries) {
    const label = dayLabel(c.t);
    const last = days[days.length - 1];
    if (last && last.label === label) last.items.push(c);
    else days.push({ label, items: [c] });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">State changes</CardTitle>
        <CardDescription>
          {entries.length === 0
            ? "The device has kept the same state since it was added."
            : `${entries.length} recent change${entries.length === 1 ? "" : "s"} · ${outages} outage${outages === 1 ? "" : "s"} · ${flaps} degraded · latest ${timeAgo(new Date(entries[0].t))}`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <p className="bg-muted text-muted-foreground rounded-2xl py-10 text-center text-sm">No state changes yet.</p>
        ) : (
          <div className="bg-muted space-y-5 rounded-2xl p-4">
            {days.map((day) => (
              <section key={day.label} className="space-y-3">
                <h4 className="text-muted-foreground text-xs font-medium">{day.label}</h4>
                <ol className="space-y-3">
                  {day.items.map((c, i) => {
                    const look = LOOK[c.to] ?? LOOK.UNKNOWN;
                    const Icon = look.icon;
                    return (
                      <li key={`${c.t}-${c.kind}-${i}`} className="flex items-start gap-3">
                        <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-full", look.chip)}>
                          <Icon className="size-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium">{headline(c)}</p>
                          <p className="text-muted-foreground text-xs">
                            {c.reason ? humanize(c.reason) : `${c.from} to ${c.to}`}
                            {c.lastedMs !== null && ` · after ${formatDuration(c.lastedMs)} ${WORD[c.from] ?? c.from.toLowerCase()}`}
                          </p>
                        </div>
                        <span className="text-muted-foreground font-mono text-xs tabular-nums">{format(c.t, "HH:mm")}</span>
                      </li>
                    );
                  })}
                </ol>
              </section>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
