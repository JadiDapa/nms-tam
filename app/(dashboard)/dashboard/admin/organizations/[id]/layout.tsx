import { notFound } from "next/navigation";
import { CalendarDays, Mail, Users as UsersIcon } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import PageHeader from "@/components/dashboard/PageHeader";
import RecordPaymentDialog from "@/components/dashboard/admin/RecordPaymentDialog";
import OrganizationTabs from "@/components/dashboard/admin/OrganizationTabs";
import { StatusBadge, SubscriptionBadge } from "@/components/dashboard/StatusBadge";
import { Button } from "@/components/ui/button";
import { OrganizationService } from "@/servers/services/organization.service";
import { PlanService } from "@/servers/services/plan.service";
import { SubscriptionService } from "@/servers/services/subscription.service";
import { UserService } from "@/servers/services/user.service";
import { BillingRequestService } from "@/servers/services/billing-request.service";

type Props = {
  params: Promise<{ id: string }>;
  children: React.ReactNode;
};

// Shared across every /organizations/[id]/* page: who this client is, at a glance, plus the tabs that split
// what used to be one long page (billing, devices, users, activity) into separate ones, like the client's own
// dashboard nav.
export default async function OrganizationLayout({ params, children }: Props) {
  await requireAdmin();
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();

  const org = await OrganizationService.getById(id);
  if (!org) notFound();

  const [ent, plans, users, openRequests] = await Promise.all([
    SubscriptionService.getEntitlements(id),
    PlanService.list(),
    UserService.list({ orgId: id }),
    BillingRequestService.list({ orgId: id, status: "OPEN" }),
  ]);
  const sub = org.subscription;
  const activePlans = plans.filter((p) => p.isActive || p.id === sub?.planId);

  const initials =
    org.name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]!.toUpperCase())
      .join("") || "?";

  const primaryContact = [...users].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0] ?? null;

  return (
    <main className="w-full space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <span className="from-primary flex size-14 shrink-0 items-center justify-center rounded-2xl bg-linear-to-b to-[oklch(0.62_0.2_34)] text-lg font-semibold text-white">
            {initials}
          </span>
          <div className="space-y-2">
            <PageHeader title={org.name} subtitle={org.note ?? undefined} />
            <div className="flex flex-wrap items-center gap-2">
              <SubscriptionBadge status={ent.status} />
              {org.status === "SUSPENDED" && <StatusBadge label="SUSPENDED" tone="red" />}
            </div>
            <div className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
              <span className="flex items-center gap-1.5">
                <CalendarDays className="size-3.5" />
                Client since {formatDate(org.createdAt)}
              </span>
              {primaryContact && (
                <span className="flex items-center gap-1.5">
                  <Mail className="size-3.5" />
                  {primaryContact.name ?? primaryContact.email}
                  {primaryContact.name && <span className="text-muted-foreground/70">· {primaryContact.email}</span>}
                </span>
              )}
              <span className="flex items-center gap-1.5">
                <UsersIcon className="size-3.5" />
                {users.length} team member{users.length === 1 ? "" : "s"}
              </span>
            </div>
          </div>
        </div>
        <RecordPaymentDialog
          orgId={id}
          plans={activePlans.map((p) => ({ id: p.id, name: p.name, priceMonthly: p.priceMonthly, extraSlotPrice: p.extraSlotPrice }))}
          subscription={
            sub
              ? {
                  planId: sub.planId,
                  status: sub.status,
                  live: ent.live,
                  extraSlots: sub.extraSlots,
                  currentPeriodEnd: sub.currentPeriodEnd.toISOString(),
                  plan: { id: sub.plan.id, name: sub.plan.name, priceMonthly: sub.plan.priceMonthly, extraSlotPrice: sub.plan.extraSlotPrice },
                }
              : null
          }
          trigger={<Button>Record payment</Button>}
        />
      </div>

      <OrganizationTabs orgId={id} openRequests={openRequests.length} />

      {children}
    </main>
  );
}
