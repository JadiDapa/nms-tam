import { requireAdmin } from "@/lib/auth";
import PageHeader from "@/components/dashboard/PageHeader";
import CreateUserDialog from "@/components/dashboard/users/CreateUserDialog";
import UserTable from "@/components/dashboard/users/UserTable";
import { OrganizationService } from "@/servers/services/organization.service";
import { UserService } from "@/servers/services/user.service";

export default async function UsersPage() {
  const admin = await requireAdmin();
  const [users, orgs] = await Promise.all([UserService.list(), OrganizationService.list()]);

  return (
    <main className="w-full space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <PageHeader title="Users" subtitle="Everyone who can sign in: our staff and each client's team." />
        <CreateUserDialog organizations={orgs.map((o) => ({ id: o.id, name: o.name }))} />
      </div>

      <div className="space-y-2">
        <UserTable
          selfId={admin.id}
          users={users.map((u) => ({
            id: u.id,
            name: u.name,
            email: u.email,
            role: u.role,
            orgId: u.orgId,
            orgName: u.org?.name ?? null,
            joined: u.clerkId !== null,
            active: u.active,
            createdAt: u.createdAt.toISOString(),
          }))}
        />
        {users.length === 0 && <p className="text-muted-foreground py-16 text-center text-sm">No users yet.</p>}
      </div>
    </main>
  );
}
