import Link from "next/link";
import { BellRing, ChevronLeft, Gauge, Plus, Radio, Send, Siren } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ruleHeadline, ruleTiming } from "@/lib/alert-text";
import { stripEngineName } from "@/servers/engine/engine-call";
import { AlertConfigService } from "@/servers/services/alert-config.service";
import { DeviceService } from "@/servers/services/device.service";
import { IncidentService } from "@/servers/services/incident.service";
import { SubscriptionService } from "@/servers/services/subscription.service";
import PageHeader from "../PageHeader";
import { StatCard, StatGroup } from "../StatCard";
import { SEVERITY_ORDER } from "../incidents/severity";
import AlertsFlow from "./AlertsFlow";
import RuleCard, { type RuleCardData } from "./RuleCard";

const TABS = [
  { key: "all", label: "All" },
  { key: "on", label: "On" },
  { key: "off", label: "Paused" },
] as const;

// The alert rules page: how well the devices are covered, how alerts flow, and every rule written out as a sentence.
export default async function AlertRulesOverview({ orgId, show }: { orgId: number; show?: string }) {
  const [rules, channels, devices, incidents, ent] = await Promise.all([
    AlertConfigService.listRules(orgId),
    AlertConfigService.listChannels(orgId),
    DeviceService.listByOrg(orgId),
    IncidentService.list(orgId, {}),
    SubscriptionService.getEntitlements(orgId),
  ]);

  const channelById = new Map(channels.map((c) => [c.id, c]));
  const cards: RuleCardData[] = rules.map(({ id, rule, device, channels: linked }) => ({
    id,
    name: stripEngineName(orgId, rule.name),
    severity: rule.severity,
    enabled: rule.enabled,
    headline: ruleHeadline(rule),
    timing: ruleTiming(rule),
    scope: rule.deviceId === null ? "All devices" : (device?.name ?? "removed device"),
    scopeDeviceId: device?.id ?? null,
    channels: linked.map((c) => ({ label: c.label, type: channelById.get(c.id)?.type ?? "unknown", enabled: channelById.get(c.id)?.enabled ?? false })),
    activeIncidents: rule.activeIncidents ?? 0,
  }));

  // ---- numbers
  const on = cards.filter((c) => c.enabled).length;
  const watchesAll = rules.some(({ rule }) => rule.enabled && rule.deviceId === null);
  const watched = new Set(rules.filter(({ rule, device }) => rule.enabled && rule.deviceId !== null && device).map(({ device }) => device!.id));
  const covered = watchesAll ? devices.length : devices.filter((d) => watched.has(d.id)).length;
  const coverage = devices.length === 0 ? null : Math.round((covered / devices.length) * 100);

  const cutoff = new Date().getTime() - 30 * 86_400_000;
  const last30 = incidents.items.filter((x) => new Date(x.incident.triggeredAt).getTime() > cutoff).length;
  const active = incidents.items.filter((x) => x.incident.status !== "RESOLVED").length;
  const channelsOn = channels.filter((c) => c.enabled).length;

  // ---- the rules, on first, then by how serious
  const tab = TABS.some((t) => t.key === show) ? show! : "all";
  const shown = cards
    .filter((c) => (tab === "on" ? c.enabled : tab === "off" ? !c.enabled : true))
    .sort(
      (a, b) =>
        Number(b.enabled) - Number(a.enabled) ||
        SEVERITY_ORDER.indexOf(a.severity as (typeof SEVERITY_ORDER)[number]) - SEVERITY_ORDER.indexOf(b.severity as (typeof SEVERITY_ORDER)[number]) ||
        a.name.localeCompare(b.name),
    );
  const counts = { all: cards.length, on, off: cards.length - on };

  return (
    <main className="w-full space-y-6">
      <div className="space-y-3">
        <Link href="/dashboard/incidents" className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm transition-colors">
          <ChevronLeft className="size-4" />
          Incidents
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <PageHeader title="Alert rules" subtitle="What to watch, when it counts as a problem, and who is told." />
          <Button asChild disabled={!ent.live} className="rounded-xl">
            <Link href="/dashboard/alerts/new">
              <Plus />
              New rule
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <StatGroup className="lg:col-span-2">
          <StatCard
            featured
            label="Rules"
            value={cards.length}
            icon={BellRing}
            pill={{ label: `${on} on`, tone: "green" }}
            caption={`${cards.length - on} paused`}
          />
          <StatCard
            label="Coverage"
            value={coverage === null ? "—" : `${coverage}%`}
            icon={Gauge}
            pill={coverage === null ? undefined : coverage === 100 ? { label: "Every device", tone: "green" } : { label: `${devices.length - covered} unwatched`, tone: "yellow" }}
            caption="of devices watched"
          />
          <StatCard
            href="/dashboard/incidents"
            label="Incidents"
            value={last30}
            icon={Siren}
            pill={active > 0 ? { label: `${active} active`, tone: "red" } : { label: "None active", tone: "green" }}
            caption="last 30 days"
          />
          <StatCard
            href="/dashboard/channels"
            label="Channels"
            value={channels.length}
            icon={Radio}
            pill={channels.length === 0 ? { label: "None yet", tone: "yellow" } : { label: `${channelsOn} on`, tone: channelsOn > 0 ? "green" : "yellow" }}
            caption="where alerts go"
          />
        </StatGroup>
        <AlertsFlow className="lg:col-span-3" rules={{ total: cards.length, on }} incidents={{ last30, active }} channels={{ total: channels.length, on: channelsOn }} />
      </div>

      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b">
          <nav className="flex gap-1" aria-label="Rule state">
            {TABS.map((t) => (
              <Link
                key={t.key}
                href={t.key === "all" ? "/dashboard/alerts" : `/dashboard/alerts?show=${t.key}`}
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
          <p className="text-muted-foreground pb-2.5 text-xs">
            <Send className="mr-1 inline size-3" />
            Rules with no channel still track problems on the device, but nobody is messaged.
          </p>
        </div>

        {shown.length === 0 ? (
          <p className="bg-card text-muted-foreground rounded-3xl py-16 text-center text-sm">
            {cards.length === 0 ? "No alert rules yet. Without a rule, problems are still tracked on the device but nobody is notified." : "No rule in this view."}
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {shown.map((c) => (
              <RuleCard key={c.id} rule={c} canChange={ent.live} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
