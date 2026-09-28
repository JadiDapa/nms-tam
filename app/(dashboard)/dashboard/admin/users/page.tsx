import { MailQuestion, ShieldCheck, UserCheck, Users as UsersIcon } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import PageHeader from "@/components/dashboard/PageHeader";
import { StatCard, StatGroup } from "@/components/dashboard/StatCard";
import CreateUserDialog from "@/components/dashboard/users/CreateUserDialog";
import UserTable from "@/components/dashboard/users/UserTable";
import { OrganizationService } from "@/servers/services/organization.service";
import { UserService } from "@/servers/services/user.service";

export default async function UsersPage() {
  const admin = await requireAdmin();
  const [users, orgs] = await Promise.all([UserService.list(), OrganizationService.list()]);

  const rows = users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    orgId: u.orgId,
    orgName: u.org?.name ?? null,
    joined: u.clerkId !== null,
    active: u.active,
    createdAt: u.createdAt.toISOString(),
  }));

  const staff = rows.filter((u) => u.role === "ADMIN").length;
  const active = rows.filter((u) => u.active && u.joined).length;
  const invited = rows.filter((u) => u.active && !u.joined).length;

  return (
    <main className="w-full space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <PageHeader title="Users" subtitle="Everyone who can sign in: our staff and each client's team." />
        <CreateUserDialog organizations={orgs.map((o) => ({ id: o.id, name: o.name }))} />
      </div>

      {rows.length > 0 && (
        <StatGroup className="lg:grid-cols-4">
          <StatCard label="Total users" value={rows.length} icon={UsersIcon} featured caption={`across ${orgs.length} clients + staff`} />
          <StatCard label="Our staff" value={staff} icon={ShieldCheck} caption="admin role" />
          <StatCard label="Active" value={active} icon={UserCheck} caption="signed in at least once" />
          <StatCard
            label="Pending invites"
            value={invited}
            icon={MailQuestion}
            pill={invited > 0 ? { label: "Awaiting sign-in", tone: "yellow" } : { label: "All joined", tone: "green" }}
          />
        </StatGroup>
      )}

      <div className="space-y-2">
        <UserTable selfId={admin.id} users={rows} />
        {rows.length === 0 && <p className="text-muted-foreground py-16 text-center text-sm">No users yet.</p>}
      </div>
    </main>
  );
}
