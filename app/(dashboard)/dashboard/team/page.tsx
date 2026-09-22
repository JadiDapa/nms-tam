import { requireClient } from "@/lib/auth";
import PageHeader from "@/components/dashboard/PageHeader";
import QuotaBar from "@/components/dashboard/QuotaBar";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import UserCard from "@/components/dashboard/users/UserCard";
import { SubscriptionService } from "@/servers/services/subscription.service";
import { UserService } from "@/servers/services/user.service";

export default async function TeamPage() {
  const { orgId } = await requireClient();
  const [users, ent] = await Promise.all([UserService.list({ orgId }), SubscriptionService.getEntitlements(orgId)]);

  return (
    <main className="w-full space-y-6">
      <PageHeader title="Team" subtitle="People in your organization. To add or remove someone, contact your administrator." />

      <div className="max-w-md">
        <QuotaBar label="Team members" used={users.filter((u) => u.active).length} limit={ent.userLimit} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {users.map((u) => (
          <div key={u.id} className="space-y-1">
            <UserCard user={u} />
            {!u.clerkId && <StatusBadge label="INVITED, NOT JOINED YET" tone="yellow" />}
            {!u.active && <StatusBadge label="DEACTIVATED" tone="gray" />}
          </div>
        ))}
      </div>
    </main>
  );
}
