import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { formatDate, formatIDR } from "@/lib/format";
import { monthlyCost } from "@/servers/billing/pricing";
import PageHeader from "@/components/dashboard/PageHeader";
import QuotaBar from "@/components/dashboard/QuotaBar";
import RecordPaymentDialog from "@/components/dashboard/admin/RecordPaymentDialog";
import SubscriptionControls from "@/components/dashboard/admin/SubscriptionControls";
import PaymentList from "@/components/dashboard/billing/PaymentList";
import CreateUserDialog from "@/components/dashboard/users/CreateUserDialog";
import UserTable from "@/components/dashboard/users/UserTable";
import { StatusBadge, SubscriptionBadge } from "@/components/dashboard/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { OrganizationService } from "@/servers/services/organization.service";
import { PaymentService } from "@/servers/services/payment.service";
import { PlanService } from "@/servers/services/plan.service";
import { SubscriptionService } from "@/servers/services/subscription.service";
import { UserService } from "@/servers/services/user.service";
import { BillingRequestService } from "@/servers/services/billing-request.service";
import { AuditService } from "@/servers/services/audit.service";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function OrganizationPage({ params }: Props) {
  const admin = await requireAdmin();
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();

  const org = await OrganizationService.getById(id);
  if (!org) notFound();

  const [ent, usage, plans, payments, users, requests, audit] = await Promise.all([
    SubscriptionService.getEntitlements(id),
    SubscriptionService.usage(id),
    PlanService.list(),
    PaymentService.list({ orgId: id }),
    UserService.list({ orgId: id }),
    BillingRequestService.list({ orgId: id, status: "OPEN" }),
    AuditService.list({ orgId: id, take: 15 }),
  ]);
  const sub = org.subscription;
  const activePlans = plans.filter((p) => p.isActive || p.id === sub?.planId);

  return (
    <main className="w-full space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <PageHeader title={org.name} subtitle={org.note ?? `Client since ${formatDate(org.createdAt)}`} />
          <div className="flex items-center gap-2">
            <SubscriptionBadge status={ent.status} />
            {org.status === "SUSPENDED" && <StatusBadge label="SUSPENDED" tone="red" />}
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

      <Card className="border-border/60">
        <CardContent className="space-y-4 p-5">
          {sub ? (
            <>
              <div className="grid gap-4 text-sm sm:grid-cols-4">
                <div>
                  <p className="text-muted-foreground text-xs">Plan</p>
                  <p className="font-medium">{sub.plan.name}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Paid until</p>
                  <p className="font-medium">{formatDate(sub.currentPeriodEnd)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Monthly cost</p>
                  <p className="font-medium">{formatIDR(monthlyCost(sub.plan, sub.extraSlots))}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Fastest polling</p>
                  <p className="font-medium">{sub.plan.minPollIntervalSec} s</p>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <QuotaBar label={`Device slots (${sub.plan.maxDevices} + ${sub.extraSlots} extra)`} used={usage.devices} limit={ent.deviceLimit} />
                <QuotaBar label="Users" used={usage.users} limit={ent.userLimit} />
              </div>
            </>
          ) : (
            <p className="text-muted-foreground text-sm">No subscription yet. Record the first payment to activate a plan.</p>
          )}
          <SubscriptionControls
            orgId={id}
            orgStatus={org.status}
            hasSubscription={sub !== null}
            planId={sub?.planId ?? null}
            extraSlots={sub?.extraSlots ?? 0}
            plans={activePlans.map((p) => ({ id: p.id, name: p.name, priceMonthly: p.priceMonthly, maxDevices: p.maxDevices }))}
          />
        </CardContent>
      </Card>

      {requests.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-lg font-semibold">Open requests</h2>
          {requests.map((r) => (
            <div key={r.id} className="bg-card flex items-center justify-between rounded-lg border px-4 py-3 text-sm">
              <span>
                {r.kind === "EXTRA_SLOTS" ? `${r.slots} extra slots` : r.kind === "PLAN_CHANGE" ? "Plan change" : "Renewal"} by {r.requestedBy.name ?? r.requestedBy.email}
                {r.message && <span className="text-muted-foreground"> · “{r.message}”</span>}
              </span>
              <span className="text-muted-foreground text-xs">{formatDate(r.createdAt)}</span>
            </div>
          ))}
          <p className="text-muted-foreground text-xs">Mark them done under Requests after you recorded the payment.</p>
        </div>
      )}

      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Payments</h2>
        <PaymentList
          payments={payments.map((p) => ({
            id: p.id, receiptNumber: p.receiptNumber, kind: p.kind, amount: p.amount, method: p.method,
            paidAt: p.paidAt, reference: p.reference, coversUntil: p.coversUntil, voidedAt: p.voidedAt,
          }))}
        />
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Users</h2>
          <CreateUserDialog organizations={[{ id, name: org.name }]} fixedOrgId={id} />
        </div>
        <UserTable
          selfId={admin.id}
          users={users.map((u) => ({
            id: u.id, name: u.name, email: u.email, role: u.role, orgId: u.orgId, orgName: u.org?.name ?? null,
            joined: u.clerkId !== null, active: u.active, createdAt: u.createdAt.toISOString(),
          }))}
        />
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Recent activity</h2>
        <ul className="bg-card divide-y rounded-lg border text-sm">
          {audit.map((a) => (
            <li key={a.id} className="flex justify-between gap-4 px-4 py-2">
              <span>{a.action}</span>
              <span className="text-muted-foreground text-xs">{formatDate(a.createdAt)}</span>
            </li>
          ))}
          {audit.length === 0 && <li className="text-muted-foreground px-4 py-6 text-center">Nothing yet.</li>}
        </ul>
      </div>
    </main>
  );
}
