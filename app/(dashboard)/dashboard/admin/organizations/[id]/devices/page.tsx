import { Suspense } from "react";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import AutoRefresh from "@/components/dashboard/AutoRefresh";
import ChartCardSkeleton from "@/components/dashboard/dashboard/ChartCardSkeleton";
import ClientStatGroup from "@/components/dashboard/dashboard/ClientStatGroup";
import DeviceListPanel from "@/components/dashboard/dashboard/DeviceListPanel";
import LatencyPanel from "@/components/dashboard/dashboard/LatencyPanel";
import TrafficPanel from "@/components/dashboard/dashboard/TrafficPanel";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import CreateUserDialog from "@/components/dashboard/users/CreateUserDialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DeviceMonitorService } from "@/servers/services/device-monitor.service";
import { IncidentService } from "@/servers/services/incident.service";
import { OrganizationService } from "@/servers/services/organization.service";
import { SubscriptionService } from "@/servers/services/subscription.service";
import { UserService } from "@/servers/services/user.service";

type Props = {
  params: Promise<{ id: string }>;
};

// Mirrors the client's own Devices page: quick tiles + compact charts beside them, full device list below. Who
// has access sits right here too — a client is one user managing their own devices, not a "team" page — so it's
// a compact strip, not a whole tab.
export default async function OrganizationDevicesPage({ params }: Props) {
  await requireAdmin();
  const id = Number((await params).id);

  const org = await OrganizationService.getById(id);
  if (!org) notFound();

  const [{ rows, engineOk }, ent, incidents, users] = await Promise.all([
    DeviceMonitorService.fleet(id),
    SubscriptionService.getEntitlements(id),
    IncidentService.list(id, { status: "ACTIVE" }).catch(() => ({ items: [], total: 0 })),
    UserService.list({ orgId: id }),
  ]);

  return (
    <div className="space-y-6">
      <AutoRefresh seconds={15} />

      {!engineOk && (
        <p className="bg-destructive/10 text-destructive rounded-lg px-4 py-2 text-sm">
          Live status is temporarily unavailable. Devices are listed, but their health cannot be shown right now.
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-5">
        <ClientStatGroup rows={rows} deviceLimit={ent.deviceLimit} activeIncidents={incidents.total} className="lg:col-span-2" />
        <div className="flex flex-col gap-4 lg:col-span-3">
          <Suspense fallback={<ChartCardSkeleton compact className="flex-1" />}>
            <LatencyPanel orgId={id} compact className="flex-1" />
          </Suspense>
          <Suspense fallback={<ChartCardSkeleton compact className="flex-1" />}>
            <TrafficPanel orgId={id} compact className="flex-1" />
          </Suspense>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Who manages these devices</CardTitle>
          <CreateUserDialog organizations={[{ id, name: org.name }]} fixedOrgId={id} />
        </CardHeader>
        <CardContent>
          {users.length === 0 ? (
            <p className="text-muted-foreground py-4 text-center text-sm">No user yet — invite one so this client can sign in.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {users.map((u) => (
                <div key={u.id} className="bg-muted flex items-center gap-2.5 rounded-full py-1.5 pr-3 pl-1.5 text-sm">
                  <span className="bg-primary text-primary-foreground flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold">
                    {(u.name || u.email).charAt(0).toUpperCase()}
                  </span>
                  <span className="font-medium">{u.name ?? u.email}</span>
                  <StatusBadge
                    label={!u.active ? "DEACTIVATED" : u.clerkId ? "ACTIVE" : "INVITED"}
                    tone={!u.active ? "gray" : u.clerkId ? "green" : "yellow"}
                  />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Suspense fallback={<ChartCardSkeleton />}>
        <DeviceListPanel orgId={id} rows={rows} canAdd={false} title="All devices" basePath={`/dashboard/admin/organizations/${id}/devices`} />
      </Suspense>
    </div>
  );
}
