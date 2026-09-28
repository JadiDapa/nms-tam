import { Building2, CircleCheck, HardDrive, TriangleAlert } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import PageHeader from "@/components/dashboard/PageHeader";
import { StatCard, StatGroup } from "@/components/dashboard/StatCard";
import CreateOrganizationDialog from "@/components/dashboard/admin/CreateOrganizationDialog";
import OrganizationTable from "@/components/dashboard/admin/OrganizationTable";
import { OrganizationService } from "@/servers/services/organization.service";
import { deviceLimit, isLive } from "@/servers/billing/pricing";

export default async function OrganizationsPage() {
  await requireAdmin();
  const orgs = await OrganizationService.list();
  const now = new Date();

  const rows = orgs.map((o) => {
    const sub = o.subscription;
    const live = isLive(sub ? { orgActive: o.status === "ACTIVE", status: sub.status, currentPeriodEnd: sub.currentPeriodEnd } : null, now);
    return {
      id: o.id,
      name: o.name,
      orgStatus: o.status,
      planName: sub?.plan.name ?? null,
      subscriptionStatus: !sub ? "NONE" : sub.status === "ACTIVE" && !live ? "EXPIRED" : sub.status,
      devices: o._count.devices,
      deviceLimit: sub ? deviceLimit(sub.plan, sub.extraSlots) : 0,
      users: o._count.users,
      paidUntil: sub?.currentPeriodEnd.toISOString() ?? null,
    };
  });

  const activeCount = rows.filter((r) => r.subscriptionStatus === "ACTIVE").length;
  const attention = rows.filter((r) => r.subscriptionStatus === "EXPIRED" || r.subscriptionStatus === "NONE").length;
  const totalDevices = rows.reduce((sum, r) => sum + r.devices, 0);
  const totalDeviceLimit = rows.reduce((sum, r) => sum + r.deviceLimit, 0);

  return (
    <main className="w-full space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <PageHeader title="Clients" subtitle="Every client company, its plan and how much of it they use." />
        <CreateOrganizationDialog />
      </div>

      {orgs.length > 0 && (
        <StatGroup className="lg:grid-cols-4">
          <StatCard label="Total clients" value={orgs.length} icon={Building2} featured />
          <StatCard
            label="Active"
            value={activeCount}
            icon={CircleCheck}
            caption={`of ${orgs.length} clients`}
          />
          <StatCard
            label="Needs attention"
            value={attention}
            icon={TriangleAlert}
            pill={attention > 0 ? { label: "Follow up", tone: "yellow" } : { label: "All good", tone: "green" }}
          />
          <StatCard
            label="Devices in use"
            value={totalDevices}
            icon={HardDrive}
            caption={`of ${totalDeviceLimit} slots sold`}
          />
        </StatGroup>
      )}

      <div className="space-y-2">
        <OrganizationTable organizations={rows} />
        {orgs.length === 0 && <p className="text-muted-foreground py-16 text-center text-sm">No clients yet.</p>}
      </div>
    </main>
  );
}
