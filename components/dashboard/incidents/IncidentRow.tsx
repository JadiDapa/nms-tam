import Link from "next/link";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { formatDuration } from "@/lib/format";
import { formatReading } from "@/lib/incident-stats";
import { IncidentBadge } from "../StatusBadge";
import IncidentDetailSheet from "./IncidentDetailSheet";
import { severityOf } from "./severity";

export type IncidentData = {
  id: string;
  severity: string;
  title: string;
  ruleName: string;
  deviceId: number | null;
  deviceName: string;
  status: string;
  triggeredAt: string;
  resolvedAt: string | null;
  metric: string | null;
  value: number | null;
  threshold: number | null;
  error: string | null;
  acknowledgedBy: string | null;
};

type Props = {
  incident: IncidentData;
  // the longest duration in the list: the bars are drawn relative to it
  longestMs: number;
  now: number;
};

// "High CPU: RT-POLDA-SUMSEL [ether1]" -> "RT-POLDA-SUMSEL [ether1]" (the rule is already the headline)
const subject = (i: IncidentData) => (i.title.startsWith(`${i.ruleName}: `) ? i.title.slice(i.ruleName.length + 2) : i.deviceName);

export function incidentDurationMs(i: Pick<IncidentData, "triggeredAt" | "resolvedAt">, now: number) {
  return Math.max(0, (i.resolvedAt ? new Date(i.resolvedAt).getTime() : now) - new Date(i.triggeredAt).getTime());
}

// One incident in the log: severity rail, what happened and where, the reading against its limit, how long it lasted, and its state.
export default function IncidentRow({ incident: i, longestMs, now }: Props) {
  const sev = severityOf(i.severity);
  const Icon = sev.icon;
  const ongoing = i.status !== "RESOLVED";
  const dur = incidentDurationMs(i, now);
  const share = longestMs > 0 ? Math.min(1, dur / longestMs) : 0;
  const reading = formatReading(i.metric, i.value);
  // incidents without a number (link down, device unreachable) say what happened instead
  const note = i.error ?? (i.metric === "if_oper_status" ? "The link went down" : "No reading");
  const limit = formatReading(i.metric, i.threshold);

  return (
    <li className="hover:bg-muted/70 group relative flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl py-3 pr-3 pl-5 transition-colors">
      <span className={cn("absolute top-3 bottom-3 left-1 w-1 rounded-full", sev.rail, !ongoing && "opacity-40")} />

      <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-full", sev.chip)}>
        <Icon className="size-4.5" />
      </span>

      <div className="min-w-56 flex-1">
        <Link href={`/dashboard/incidents/${i.id}`} className="block truncate text-base font-medium hover:underline">
          {i.ruleName}
        </Link>
        <p className="text-muted-foreground truncate text-xs">
          {subject(i)} · <span className="font-mono tabular-nums">{format(new Date(i.triggeredAt), "HH:mm")}</span>
        </p>
      </div>

      <div className="hidden w-36 shrink-0 md:block">
        {reading ? (
          <>
            <p className="font-mono text-sm font-medium tabular-nums">{reading}</p>
            {limit && <p className="text-muted-foreground text-xs">limit {limit}</p>}
          </>
        ) : (
          <p className="text-muted-foreground line-clamp-2 text-xs">{note}</p>
        )}
      </div>

      <div className="hidden w-44 shrink-0 lg:block">
        <p className="flex items-center gap-1.5 font-mono text-sm tabular-nums">
          {ongoing && <span className={cn("size-1.5 animate-pulse rounded-full", sev.dot)} />}
          {formatDuration(dur)}
          <span className="text-muted-foreground font-sans text-xs">{ongoing ? "and counting" : "to resolve"}</span>
        </p>
        <div className="bg-foreground/10 mt-1.5 h-1 overflow-hidden rounded-full">
          <div className={cn("h-full rounded-full", ongoing ? sev.rail : "bg-foreground/30")} style={{ width: `${Math.max(share * 100, 3)}%` }} />
        </div>
      </div>

      <div className="flex w-48 shrink-0 items-center justify-end gap-2">
        <IncidentBadge status={i.status} />
        <IncidentDetailSheet incident={i} now={now} />
      </div>
    </li>
  );
}
