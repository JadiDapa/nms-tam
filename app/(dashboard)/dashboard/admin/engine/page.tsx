import { requireAdmin } from "@/lib/auth";
import PageHeader from "@/components/dashboard/PageHeader";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { DeleteOrphanButton, SyncButton } from "@/components/dashboard/admin/EngineTools";
import { EngineAdminService, type OrphanKind } from "@/servers/services/engine-admin.service";

const GROUPS: { key: "devices" | "credentials" | "channels" | "rules"; kind: OrphanKind; title: string }[] = [
  { key: "devices", kind: "device", title: "Devices" },
  { key: "credentials", kind: "credential", title: "Credentials" },
  { key: "channels", kind: "channel", title: "Channels" },
  { key: "rules", kind: "rule", title: "Alert rules" },
];

export default async function EnginePage() {
  await requireAdmin();
  const { ok, health } = await EngineAdminService.health();
  const orphans = ok ? await EngineAdminService.orphans().catch(() => null) : null;

  return (
    <main className="w-full space-y-6">
      <PageHeader title="Monitoring Engine" subtitle="The service that polls every device." />

      <div className="bg-card space-y-2 rounded-lg border p-4 text-sm">
        <div className="flex items-center justify-between">
          <span className="font-medium">Status</span>
          <StatusBadge label={ok ? "ONLINE" : "UNREACHABLE"} tone={ok ? "green" : "red"} />
        </div>
        {health && (
          <>
            <div className="flex justify-between"><span className="text-muted-foreground">Version</span><span>{health.version}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Uptime</span><span>{Math.round(health.uptimeSec / 60)} min</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Database</span><span>{health.database}</span></div>
            <pre className="bg-muted overflow-auto rounded-md p-3 text-xs">{JSON.stringify(health.scheduler, null, 2)}</pre>
          </>
        )}
        {!ok && <p className="text-destructive">The engine cannot be reached. Clients see “live status unavailable” until it is back.</p>}
      </div>

      <div>
        <SyncButton />
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Objects nobody owns</h2>
        <p className="text-muted-foreground text-sm">
          Things that exist in the engine but belong to no client, for example left behind by a crash or created by hand. They cost clients nothing.
        </p>
        {orphans === null ? (
          <p className="text-muted-foreground text-sm">Unavailable while the engine is unreachable.</p>
        ) : (
          GROUPS.map((g) => (
            <div key={g.key} className="bg-card rounded-lg border p-4">
              <h3 className="mb-2 text-sm font-medium">
                {g.title} ({orphans[g.key].length})
              </h3>
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
            </div>
          ))
        )}
      </div>
    </main>
  );
}
