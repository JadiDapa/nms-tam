import Link from "next/link";
import { format, isToday, isYesterday } from "date-fns";
import { AlertTriangle, BellRing, Clock, Search, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { formatDuration } from "@/lib/format";
import { incidentsByDay, meanResolveMs } from "@/lib/incident-stats";
import { AlertConfigService } from "@/servers/services/alert-config.service";
import { IncidentService } from "@/servers/services/incident.service";
import AutoRefresh from "../AutoRefresh";
import PageHeader from "../PageHeader";
import { StatCard, StatGroup } from "../StatCard";
import IncidentRow, { incidentDurationMs, type IncidentData } from "./IncidentRow";
import IncidentsChart from "./IncidentsChart";
import { SEVERITY_ORDER, SEVERITY_STYLE } from "./severity";

export type IncidentsQuery = { status?: string; sev?: string; q?: string; all?: string };

const TABS = [
  { key: "ACTIVE", label: "Active" },
  { key: "RESOLVED", label: "Resolved" },
  { key: "all", label: "All" },
] as const;

const PAGE = 40;

const dayLabel = (t: number) => {
  const d = new Date(t);
  const date = format(d, "dd MMM");
  return isToday(d) ? `Today · ${date}` : isYesterday(d) ? `Yesterday · ${date}` : format(d, "EEEE · dd MMM");
};

// The incidents page: what is wrong now, how it has been going, and the full log with filters.
export default async function IncidentsOverview({ orgId, query }: { orgId: number; query: IncidentsQuery }) {
  const [{ items, total }, rules] = await Promise.all([IncidentService.list(orgId, {}), AlertConfigService.listRules(orgId)]);

  const now = new Date();
  const nowMs = now.getTime();
  const all: IncidentData[] = items
    .map(({ incident, device }) => ({
      id: incident.id,
      severity: incident.severity,
      title: incident.title,
      ruleName: incident.ruleName,
      deviceId: device?.id ?? null,
      deviceName: device?.name ?? "removed device",
      status: incident.status,
      triggeredAt: incident.triggeredAt,
      resolvedAt: incident.resolvedAt,
      metric: incident.metric,
      value: incident.value,
      threshold: incident.threshold,
      error: incident.error,
      acknowledgedBy: incident.acknowledgedBy,
    }))
    .sort((a, b) => new Date(b.triggeredAt).getTime() - new Date(a.triggeredAt).getTime());

  // ---- the numbers on top
  const active = all.filter((i) => i.status !== "RESOLVED");
  const criticalActive = active.filter((i) => i.severity === "critical").length;
  const resolved30 = all.filter((i) => i.status === "RESOLVED" && i.resolvedAt && new Date(i.resolvedAt).getTime() > nowMs - 30 * 86_400_000).length;
  const mean = meanResolveMs(all, nowMs - 30 * 86_400_000);
  const rulesOn = rules.filter((r) => r.rule.enabled).length;

  // ---- the log
  const tab = TABS.some((t) => t.key === query.status) ? query.status! : "ACTIVE";
  const sev = SEVERITY_ORDER.find((s) => s === query.sev);
  const q = (query.q ?? "").trim().toLowerCase();
  const byTab = all.filter((i) => (tab === "ACTIVE" ? i.status !== "RESOLVED" : tab === "RESOLVED" ? i.status === "RESOLVED" : true));
  const filtered = byTab.filter(
    (i) => (!sev || i.severity === sev) && (q === "" || `${i.title} ${i.ruleName} ${i.deviceName}`.toLowerCase().includes(q)),
  );
  const shown = query.all ? filtered : filtered.slice(0, PAGE);
  const longestMs = Math.max(0, ...shown.map((i) => incidentDurationMs(i, nowMs)));

  const groups: { label: string; items: IncidentData[] }[] = [];
  for (const i of shown) {
    const label = dayLabel(new Date(i.triggeredAt).getTime());
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(i);
    else groups.push({ label, items: [i] });
  }

  const href = (o: IncidentsQuery) => {
    const p = new URLSearchParams();
    const next = { status: tab, sev: sev, q: query.q, ...o };
    if (next.status && next.status !== "ACTIVE") p.set("status", next.status);
    if (next.sev) p.set("sev", next.sev);
    if (next.q) p.set("q", next.q);
    if (next.all) p.set("all", "1");
    const s = p.toString();
    return `/dashboard/incidents${s ? `?${s}` : ""}`;
  };

  const counts = { ACTIVE: active.length, RESOLVED: all.length - active.length, all: all.length };
  const sevCount = (s: string) => byTab.filter((i) => i.severity === s).length;

  return (
    <main className="w-full space-y-6">
      <AutoRefresh seconds={15} />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader title="Incidents" subtitle="Problems found on your devices. Open one to see its details and an AI analysis of what is going on." />
        <Button asChild variant="outline" className="rounded-xl">
          <Link href="/dashboard/alerts">
            <BellRing />
            Alert rules
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <StatGroup className="lg:col-span-2">
          <StatCard
            featured
            label="Active"
            value={active.length}
            icon={ShieldAlert}
            pill={active.length > 0 ? { label: "Needs attention", tone: "yellow" } : { label: "All clear", tone: "green" }}
            caption="open now"
          />
          <StatCard
            label="Critical"
            value={criticalActive}
            icon={AlertTriangle}
            pill={criticalActive > 0 ? { label: "Needs action", tone: "red" } : { label: "None", tone: "green" }}
            caption="right now"
          />
          <StatCard
            size="md"
            label="Time to resolve"
            value={mean === null ? "—" : formatDuration(mean)}
            icon={Clock}
            pill={{ label: `${resolved30} resolved`, tone: "green" }}
            caption="average, 30 days"
          />
          <StatCard
            href="/dashboard/alerts"
            label="Alert rules"
            value={rules.length}
            icon={BellRing}
            pill={rules.length === 0 ? { label: "None yet", tone: "yellow" } : { label: `${rulesOn} on`, tone: rulesOn > 0 ? "green" : "yellow" }}
            caption="manage rules"
          />
        </StatGroup>
        <IncidentsChart className="lg:col-span-3" days={incidentsByDay(all, 30, now)} />
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-4 space-y-0 md:flex-row md:items-start md:justify-between">
          <div className="space-y-1">
            <CardTitle className="text-xl">Incident log</CardTitle>
            <CardDescription>
              {filtered.length} {filtered.length === 1 ? "incident" : "incidents"}
              {q && ` matching "${query.q}"`}
              {sev && ` · ${SEVERITY_STYLE[sev].label.toLowerCase()} only`}
            </CardDescription>
          </div>
          <form action="/dashboard/incidents" className="relative w-full md:w-72">
            {tab !== "ACTIVE" && <input type="hidden" name="status" value={tab} />}
            {sev && <input type="hidden" name="sev" value={sev} />}
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input name="q" defaultValue={query.q ?? ""} placeholder="Search incident, rule or device" aria-label="Search incidents" className="rounded-xl pl-9" />
          </form>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 border-b">
            <nav className="flex gap-1" aria-label="Incident state">
              {TABS.map((t) => (
                <Link
                  key={t.key}
                  href={href({ status: t.key, all: undefined })}
                  aria-current={t.key === tab ? "page" : undefined}
                  className={cn(
                    "-mb-px flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
                    t.key === tab ? "border-primary text-foreground" : "text-muted-foreground hover:text-foreground border-transparent",
                  )}
                >
                  {t.label}
                  <span className="text-muted-foreground font-mono text-xs tabular-nums">{counts[t.key]}</span>
                </Link>
              ))}
            </nav>

            <div className="flex items-center gap-4 pb-2.5 text-sm">
              <Link href={href({ sev: undefined, all: undefined })} className={cn("transition-colors", !sev ? "text-foreground font-medium" : "text-muted-foreground hover:text-foreground")}>
                Any severity
              </Link>
              {SEVERITY_ORDER.map((s) => (
                <Link
                  key={s}
                  href={href({ sev: s, all: undefined })}
                  className={cn("flex items-center gap-1.5 transition-colors", sev === s ? "text-foreground font-medium" : "text-muted-foreground hover:text-foreground")}
                >
                  <span className={cn("size-2 rounded-full", SEVERITY_STYLE[s].dot)} />
                  {SEVERITY_STYLE[s].label}
                  <span className="font-mono text-xs tabular-nums">{sevCount(s)}</span>
                </Link>
              ))}
            </div>
          </div>

          {groups.length === 0 ? (
            <p className="text-muted-foreground py-16 text-center text-sm">
              {q || sev ? "No incident matches these filters." : tab === "ACTIVE" ? "No active incidents. Everything looks fine." : "No incidents."}
            </p>
          ) : (
            <div className="space-y-2">
              {groups.map((g) => (
                <section key={g.label}>
                  <h4 className="text-muted-foreground px-1 pt-3 pb-1 text-xs font-medium">{g.label}</h4>
                  <ul>
                    {g.items.map((i) => (
                      <IncidentRow key={i.id} incident={i} longestMs={longestMs} now={nowMs} />
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}

          {filtered.length > shown.length && (
            <div className="flex justify-center pt-2">
              <Button asChild variant="outline" className="rounded-xl">
                <Link href={href({ all: "1" })}>Show all {filtered.length}</Link>
              </Button>
            </div>
          )}
          {total > items.length && <p className="text-muted-foreground text-center text-xs">The log holds the latest {items.length} of {total} incidents.</p>}
        </CardContent>
      </Card>
    </main>
  );
}
