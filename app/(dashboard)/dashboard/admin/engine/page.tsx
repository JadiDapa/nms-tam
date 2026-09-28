import {
  Bell,
  Cable,
  Database,
  KeyRound,
  Router,
  Server,
  ShieldQuestion,
  Timer,
} from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { formatDuration } from "@/lib/format";
import PageHeader from "@/components/dashboard/PageHeader";
import { StatCard, StatGroup } from "@/components/dashboard/StatCard";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DeleteOrphanButton, SyncButton } from "@/components/dashboard/admin/EngineTools";
import { EngineAdminService, type OrphanKind } from "@/servers/services/engine-admin.service";

const GROUPS: { key: "devices" | "credentials" | "channels" | "rules"; kind: OrphanKind; title: string; icon: typeof Router }[] = [
  { key: "devices", kind: "device", title: "Devices", icon: Router },
  { key: "credentials", kind: "credential", title: "Credentials", icon: KeyRound },
  { key: "channels", kind: "channel", title: "Channels", icon: Bell },
  { key: "rules", kind: "rule", title: "Alert rules", icon: ShieldQuestion },
];

// Humanizes a flat/shallow unknown-shaped object into label/value rows. Falls back to raw JSON for anything
// that isn't a simple record (the engine's scheduler payload shape isn't part of our contract with it).
function renderValue(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "boolean") return v ? "yes" : "no";
  if (typeof v === "number" || typeof v === "string") return String(v);
  return JSON.stringify(v);
}
const humanize = (key: string) => key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (c) => c.toUpperCase());

export default async function EnginePage() {
  await requireAdmin();
  const { ok, health } = await EngineAdminService.health();
  const orphans = ok ? await EngineAdminService.orphans().catch(() => null) : null;
  const totalOrphans = orphans ? GROUPS.reduce((sum, g) => sum + orphans[g.key].length, 0) : 0;

  const scheduler = health?.scheduler;
  const isSimpleRecord = scheduler !== null && typeof scheduler === "object" && !Array.isArray(scheduler)
    && Object.values(scheduler as Record<string, unknown>).every((v) => v === null || typeof v !== "object");

  return (
    <main className="w-full space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <PageHeader title="Monitoring Engine" subtitle="The service that polls every device." />
        <SyncButton />
      </div>

      <StatGroup className="lg:grid-cols-4">
        <StatCard label="Status" value={ok ? "Online" : "Unreachable"} icon={Server} featured pill={{ label: ok ? "Healthy" : "Down", tone: ok ? "green" : "red" }} />
        <StatCard label="Version" value={health?.version ?? "—"} icon={Cable} caption="build tag" />
        <StatCard label="Uptime" value={health ? formatDuration(health.uptimeSec * 1000) : "—"} icon={Timer} caption="since last restart" />
        <StatCard label="Orphaned objects" value={totalOrphans} icon={ShieldQuestion} pill={totalOrphans > 0 ? { label: "Review", tone: "yellow" } : { label: "Clean", tone: "green" }} />
      </StatGroup>

      {!ok && (
        <p className="bg-destructive/10 text-destructive rounded-lg px-4 py-3 text-sm">
          The engine cannot be reached. Clients see “live status unavailable” until it is back.
        </p>
      )}

      {health && (
        <Card>
          <CardHeader className="flex flex-row items-center gap-2 space-y-0">
            <Database className="text-muted-foreground size-4" />
            <CardTitle className="text-base">Database &amp; scheduler</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Database</span>
              <StatusBadge label={health.database} tone="blue" />
            </div>
            {scheduler != null && (
              isSimpleRecord ? (
                <div className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                  {Object.entries(scheduler as Record<string, unknown>).map(([k, v]) => (
                    <div key={k} className="flex items-center justify-between gap-4 border-b pb-2 last:border-b-0">
                      <span className="text-muted-foreground">{humanize(k)}</span>
                      <span className="font-mono text-xs">{renderValue(v)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <pre className="bg-muted overflow-auto rounded-lg p-3 text-xs">{JSON.stringify(scheduler, null, 2)}</pre>
              )
            )}
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        <div>
          <h2 className="text-foreground text-lg font-semibold">Objects nobody owns</h2>
          <p className="text-muted-foreground text-sm">
            Things that exist in the engine but belong to no client, for example left behind by a crash or created by hand. They cost clients nothing.
          </p>
        </div>
        {orphans === null ? (
          <p className="text-muted-foreground text-sm">Unavailable while the engine is unreachable.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {GROUPS.map((g) => {
              const Icon = g.icon;
              return (
                <Card key={g.key} className="border-border/60">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="flex items-center gap-2 text-sm font-medium">
                      <Icon className="text-muted-foreground size-4" />
                      {g.title}
                    </CardTitle>
                    <StatusBadge label={String(orphans[g.key].length)} tone={orphans[g.key].length > 0 ? "yellow" : "gray"} />
                  </CardHeader>
                  <CardContent>
                    {orphans[g.key].length === 0 ? (
                      <p className="text-muted-foreground text-sm">None.</p>
                    ) : (
                      <ul className="divide-y text-sm">
                        {orphans[g.key].map((o) => (
                          <li key={o.id} className="flex items-center justify-between gap-4 py-2">
                            <span>
                              {o.name} <span className="text-muted-foreground text-xs">{o.detail}</span>
                            </span>
                            <DeleteOrphanButton kind={g.kind} engineId={o.id} name={o.name} />
                          </li>
                        ))}
                      </ul>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
