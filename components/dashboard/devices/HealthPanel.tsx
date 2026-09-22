import { ReactNode } from "react";
import { formatDistanceToNowStrict } from "date-fns";
import { Activity, Network, Radio, type LucideIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatDateTime, formatDuration, formatMs, timeAgo } from "@/lib/format";
import { HealthBadge } from "../StatusBadge";
import type { EngineDeviceStatus, HealthSnapshot } from "@/servers/engine/engine-types";

const WORD: Record<string, string> = { UP: "Up", DOWN: "Down", DEGRADED: "Degraded", RECOVERING: "Recovering", UNKNOWN: "Unknown" };

// Small dots that fill up towards a limit, like strikes: how close a check is to changing state.
function Pips({ filled, total, tone }: { filled: number; total: number; tone: "red" | "green" }) {
  // more than a dozen dots would only be noise; the caption carries the numbers anyway
  if (total > 12) return null;
  return (
    <span className="flex items-center gap-1" aria-hidden>
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={cn("h-1.5 w-5 rounded-full", i < filled ? (tone === "red" ? "bg-red-500" : "bg-green-500") : "bg-foreground/10")} />
      ))}
    </span>
  );
}

function Panel({ icon: Icon, title, badge, children }: { icon: LucideIcon; title: string; badge?: ReactNode; children: ReactNode }) {
  return (
    <div className="bg-muted flex flex-col gap-4 rounded-2xl p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-sm font-medium">
          <span className="bg-card flex size-8 items-center justify-center rounded-[10px] border">
            <Icon className="size-4" />
          </span>
          {title}
        </span>
        {badge}
      </div>
      {children}
    </div>
  );
}

// One check (ping or SNMP): its state, for how long, and how near it is to flipping.
function CheckPanel({ icon, title, snap, failureLimit, recoveryLimit }: { icon: LucideIcon; title: string; snap: HealthSnapshot; failureLimit: number; recoveryLimit: number }) {
  const healthy = snap.state === "UP";
  const failing = snap.state === "DOWN";
  const sentence = snap.since && snap.state !== "UNKNOWN" ? `${WORD[snap.state]} for ${formatDistanceToNowStrict(new Date(snap.since))}` : (WORD[snap.state] ?? snap.state);

  return (
    <Panel icon={icon} title={title} badge={<HealthBadge state={snap.state} />}>
      <div className="space-y-1">
        <p className="text-2xl font-medium tracking-tight">{sentence}</p>
        <p className="text-muted-foreground text-xs">{snap.since ? `since ${formatDateTime(snap.since)}` : "no state recorded yet"}</p>
      </div>

      <div className="space-y-2">
        {healthy ? (
          <>
            <Pips filled={snap.failures} total={failureLimit} tone="red" />
            <p className="text-muted-foreground text-xs">
              {snap.failures} of {failureLimit} failed polls in a row before it counts as down
            </p>
          </>
        ) : snap.state === "UNKNOWN" ? (
          <p className="text-muted-foreground text-xs">Waiting for the first results.</p>
        ) : (
          <>
            <Pips filled={snap.successes} total={recoveryLimit} tone="green" />
            <p className="text-muted-foreground text-xs">
              {snap.successes} of {recoveryLimit} good polls in a row to be {failing ? "back up" : "healthy again"}
            </p>
          </>
        )}
      </div>
    </Panel>
  );
}

// How the polling itself is going: when it last ran, how long it took against the cycle, and the last time everything worked.
function PollPanel({ status }: { status: EngineDeviceStatus }) {
  const { state, device } = status;
  const cycleMs = device.polling.pollIntervalSec * 1000;
  const took = state.lastPollDurationMs;
  const share = took === null ? 0 : Math.min(1, took / cycleMs);

  return (
    <Panel icon={Activity} title="Polling">
      <div className="space-y-1">
        <p className="text-2xl font-medium tracking-tight">{timeAgo(state.lastPollAt)}</p>
        <p className="text-muted-foreground text-xs">last poll · every {device.polling.pollIntervalSec} s</p>
      </div>
      <div className="space-y-2">
        <div className="bg-foreground/10 h-1.5 overflow-hidden rounded-full">
          <div className={cn("h-full rounded-full", share > 0.5 ? "bg-amber-500" : "bg-foreground/75")} style={{ width: `${Math.max(share * 100, 2)}%` }} />
        </div>
        <p className="text-muted-foreground text-xs">
          {took === null ? "no timing yet" : `took ${formatMs(took)}, ${Math.round(share * 100)}% of the ${formatDuration(cycleMs)} cycle`}
          {state.lastSuccessAt && ` · last success ${timeAgo(state.lastSuccessAt)}`}
        </p>
      </div>
    </Panel>
  );
}

export default function HealthPanel({ status }: { status: EngineDeviceStatus }) {
  const { state, device } = status;
  const p = device.polling;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Health</CardTitle>
        <CardDescription>Each check, and how close it is to changing state</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <CheckPanel icon={Radio} title="Reachability" snap={state.reachability} failureLimit={p.failureThreshold} recoveryLimit={p.recoveryThreshold} />
          {device.snmpEnabled && (
            <CheckPanel icon={Network} title="SNMP" snap={state.snmp} failureLimit={p.snmpFailureThreshold} recoveryLimit={p.snmpRecoveryThreshold} />
          )}
          <PollPanel status={status} />
        </div>
        {state.lastError && (
          <div className="flex items-start gap-3 rounded-2xl bg-red-500/10 p-4 text-sm text-red-600 dark:text-red-400">
            <span className="mt-0.5 font-medium">Last error</span>
            <span className="min-w-0 break-words">{state.lastError}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
