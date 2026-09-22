"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ArrowUpRight, Eye, RefreshCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { analyzeIncident, getIncidentDetail } from "@/app/action/incident.action";
import type { IncidentAnalysis, SavedAnalysis } from "@/servers/services/incident-ai.service";
import { cn } from "@/lib/utils";
import { formatDateTime, formatDuration, timeAgo } from "@/lib/format";
import { formatReading } from "@/lib/incident-stats";
import { DeliveryBadge, IncidentBadge, SeverityBadge } from "../StatusBadge";
import type { IncidentData } from "./IncidentRow";
import { severityOf } from "./severity";

type Detail = Extract<Awaited<ReturnType<typeof getIncidentDetail>>, { ok: true }>["data"];

const IMPACT_TONE: Record<string, string> = {
  none: "bg-muted text-muted-foreground",
  low: "bg-blue-500/10 text-blue-600 dark:text-blue-500",
  medium: "bg-amber-500/10 text-amber-600 dark:text-amber-500",
  high: "bg-orange-500/10 text-orange-600 dark:text-orange-500",
  critical: "bg-red-500/10 text-red-600 dark:text-red-500",
};

const PRIORITY: Record<string, { label: string; tone: string }> = {
  now: { label: "Now", tone: "bg-red-500/10 text-red-600 dark:text-red-500" },
  soon: { label: "Soon", tone: "bg-amber-500/10 text-amber-600 dark:text-amber-500" },
  later: { label: "Later", tone: "bg-muted text-muted-foreground" },
};

const confidenceTone = (score: number) => (score >= 75 ? "bg-green-500" : score >= 45 ? "bg-amber-500" : "bg-red-500");

const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex justify-between gap-4 border-b py-2 text-sm last:border-b-0">
    <span className="text-muted-foreground shrink-0">{label}</span>
    <span className="text-right font-medium">{children}</span>
  </div>
);

const Section = ({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) => (
  <section className="space-y-2">
    <div className="flex items-center justify-between gap-2">
      <h3 className="text-sm font-medium">{title}</h3>
      {action}
    </div>
    {children}
  </section>
);

const Label = ({ children }: { children: React.ReactNode }) => <p className="text-muted-foreground mb-1 text-xs font-medium tracking-wide uppercase">{children}</p>;

function AnalysisView({ a }: { a: IncidentAnalysis }) {
  const score = Math.round(a.confidence.score);
  return (
    <div className="space-y-4">
      <div>
        <Label>Summary</Label>
        <p className="text-sm leading-relaxed">{a.summary}</p>
      </div>

      <div>
        <Label>Likely reason</Label>
        <p className="text-sm leading-relaxed">{a.reason}</p>
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between">
          <Label>Confidence</Label>
          <span className="font-mono text-sm font-medium tabular-nums">{score}%</span>
        </div>
        <div className="bg-foreground/10 h-1.5 overflow-hidden rounded-full">
          <div className={cn("h-full rounded-full", confidenceTone(score))} style={{ width: `${Math.max(score, 3)}%` }} />
        </div>
        <p className="text-muted-foreground mt-1.5 text-xs">{a.confidence.rationale}</p>
      </div>

      <div>
        <Label>Evidence</Label>
        {a.evidence.length === 0 ? (
          <p className="text-muted-foreground text-sm">No supporting evidence in the data.</p>
        ) : (
          <ul className="space-y-1.5">
            {a.evidence.map((e, i) => (
              <li key={i} className="bg-background rounded-xl border px-3 py-2 text-sm">
                <span className="font-medium">{e.signal}</span>
                <span className="text-muted-foreground"> · {e.observation}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <div className="mb-1 flex items-center gap-2">
          <Label>Impact</Label>
          <span className={cn("mb-1 rounded-[6px] px-2 py-0.5 text-xs font-medium capitalize", IMPACT_TONE[a.impact.level])}>{a.impact.level}</span>
        </div>
        <p className="text-sm leading-relaxed">{a.impact.description}</p>
      </div>

      <div>
        <Label>Recommended actions</Label>
        <ol className="space-y-1.5">
          {a.actions.map((s, i) => (
            <li key={i} className="flex items-start gap-3 text-sm">
              <span className="text-muted-foreground mt-0.5 w-4 shrink-0 font-mono text-xs tabular-nums">{i + 1}.</span>
              <span className="flex-1">{s.step}</span>
              <span className={cn("shrink-0 rounded-[6px] px-2 py-0.5 text-xs font-medium", PRIORITY[s.priority].tone)}>{PRIORITY[s.priority].label}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

// The "Detail" button of an incident row: a side sheet with the full incident and an optional AI analysis of it.
export default function IncidentDetailSheet({ incident: i, now }: { incident: IncidentData; now: number }) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ai, setAi] = useState<SavedAnalysis | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [loading, startLoading] = useTransition();
  const [analyzing, startAnalyzing] = useTransition();

  const sev = severityOf(i.severity);
  const Icon = sev.icon;

  function load() {
    setError(null);
    startLoading(async () => {
      const r = await getIncidentDetail(i.id);
      if (!r.ok) return setError(r.error);
      setDetail(r.data);
      setAi(r.data.analysis);
    });
  }

  function analyze() {
    setAiError(null);
    startAnalyzing(async () => {
      const r = await analyzeIncident(i.id);
      if (r.ok) setAi(r.data);
      else setAiError(r.error);
    });
  }

  const inc = detail?.incident;
  const reading = formatReading(inc?.metric ?? i.metric, inc?.value ?? i.value);
  const limit = formatReading(inc?.metric ?? i.metric, inc?.threshold ?? i.threshold);
  const end = inc?.resolvedAt ?? i.resolvedAt;
  const status = inc?.status ?? i.status;

  return (
    <Sheet onOpenChange={(open) => open && load()}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="rounded-xl">
          <Eye className="size-4" />
          Detail
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full gap-0 overflow-y-auto data-[side=right]:sm:max-w-xl">
        <SheetHeader className="border-b pr-14">
          <div className="flex items-center gap-3">
            <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-full", sev.chip)}>
              <Icon className="size-4.5" />
            </span>
            <div className="min-w-0">
              <SheetTitle className="truncate text-lg">{i.ruleName}</SheetTitle>
              <SheetDescription className="truncate">{i.title}</SheetDescription>
            </div>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <SeverityBadge severity={i.severity} />
            <IncidentBadge status={inc?.status ?? i.status} />
          </div>
        </SheetHeader>

        <div className="space-y-6 p-6">
          <Section title="Details">
            <div className="bg-muted rounded-2xl px-4 py-1">
              <Row label="Device">
                {i.deviceId ? (
                  <Link href={`/dashboard/devices/${i.deviceId}`} className="hover:underline">
                    {i.deviceName}
                  </Link>
                ) : (
                  i.deviceName
                )}
              </Row>
              <Row label="Started">
                {formatDateTime(i.triggeredAt)} <span className="text-muted-foreground font-normal">({timeAgo(i.triggeredAt)})</span>
              </Row>
              <Row label="Duration">
                {formatDuration((end ? new Date(end).getTime() : now) - new Date(i.triggeredAt).getTime())}
                {!end && <span className="text-muted-foreground font-normal"> and counting</span>}
              </Row>
              {(inc?.metric ?? i.metric) && (
                <Row label="Reading">
                  <span className="font-mono tabular-nums">{reading ?? "—"}</span>
                  {limit && <span className="text-muted-foreground font-normal"> (limit {limit})</span>}
                </Row>
              )}
              {(inc?.error ?? i.error) && <Row label="Error">{inc?.error ?? i.error}</Row>}
              {inc?.acknowledgedAt && (
                <Row label="Acknowledged">
                  {formatDateTime(inc.acknowledgedAt)}
                  {inc.acknowledgedBy && ` by ${inc.acknowledgedBy}`}
                </Row>
              )}
              {inc?.resolvedAt && (
                <Row label="Resolved">
                  {formatDateTime(inc.resolvedAt)}
                  {inc.resolutionReason && <span className="text-muted-foreground font-normal"> ({inc.resolutionReason})</span>}
                </Row>
              )}
              {inc && <Row label="Last seen">{timeAgo(inc.lastSeenAt)}</Row>}
            </div>
          </Section>

          <Section title="Notifications">
            {loading && !detail ? (
              <Skeleton className="h-16" />
            ) : error ? (
              <div className="text-destructive flex items-center justify-between gap-2 text-sm">
                {error}
                <Button variant="outline" size="sm" className="rounded-xl" onClick={load}>
                  Retry
                </Button>
              </div>
            ) : detail && detail.deliveries.length === 0 ? (
              <p className="text-muted-foreground text-sm">No notification was sent for this incident (the rule has no channel).</p>
            ) : (
              <ul className="space-y-3">
                {detail?.deliveries.map((d, n) => (
                  <li key={n} className="text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{d.channelName}</span>
                      <span className="text-muted-foreground text-xs">
                        {d.channelType} · {d.event}
                      </span>
                      <DeliveryBadge phase={d.phase} />
                    </div>
                    <p className="text-muted-foreground text-xs">
                      {d.attempts} attempt{d.attempts === 1 ? "" : "s"}
                      {d.sentAt && ` · delivered ${timeAgo(d.sentAt)}`}
                      {d.nextAttemptAt && ` · next try ${formatDateTime(d.nextAttemptAt)}`}
                    </p>
                    {d.lastError && <p className="text-destructive text-xs">{d.lastError}</p>}
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section
            title="AI analysis"
            action={
              ai && (
                <Button variant="ghost" size="sm" className="rounded-xl" onClick={analyze} disabled={analyzing}>
                  {analyzing ? <Spinner /> : <RefreshCw className="size-4" />}
                  Regenerate
                </Button>
              )
            }
          >
            <div className="bg-muted rounded-2xl p-4">
              {detail && !detail.aiEnabled ? (
                <p className="text-muted-foreground text-sm">The AI analyzer is not set up. Add GEMINI_API_KEY to the environment to turn it on.</p>
              ) : loading && !detail ? (
                <Skeleton className="bg-foreground/10 h-20" />
              ) : analyzing && !ai ? (
                <div className="space-y-3">
                  <p className="text-muted-foreground flex items-center gap-2 text-sm">
                    <Spinner /> Analyzing this incident…
                  </p>
                  <Skeleton className="bg-foreground/10 h-4 w-3/4" />
                  <Skeleton className="bg-foreground/10 h-4 w-full" />
                  <Skeleton className="bg-foreground/10 h-4 w-2/3" />
                </div>
              ) : ai ? (
                <div className={cn("transition-opacity", analyzing && "opacity-50")}>
                  {ai.incidentStatus !== status && (
                    <p className="mb-4 rounded-xl bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-500">
                      Analyzed while the incident was {ai.incidentStatus}; it is {status} now. Regenerate for an up-to-date look.
                    </p>
                  )}
                  <AnalysisView a={ai.analysis} />
                  <p className="text-muted-foreground mt-4 border-t pt-3 text-xs">
                    Generated by {ai.model} · {formatDateTime(ai.analyzedAt)} ({timeAgo(ai.analyzedAt)}). AI can be wrong, check before acting.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-start gap-3">
                  <p className="text-muted-foreground text-sm">
                    Get a short summary, the likely reason, how sure it is, the evidence, the impact and what to do next.
                  </p>
                  <Button className="rounded-xl" onClick={analyze} disabled={!detail}>
                    <Sparkles className="size-4" />
                    Analyze with AI
                  </Button>
                </div>
              )}
              {aiError && <p className="text-destructive mt-3 text-sm">{aiError}</p>}
            </div>
          </Section>

          <Button asChild variant="outline" className="w-full rounded-xl">
            <Link href={`/dashboard/incidents/${i.id}`}>
              Open full page
              <ArrowUpRight className="size-4" />
            </Link>
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
