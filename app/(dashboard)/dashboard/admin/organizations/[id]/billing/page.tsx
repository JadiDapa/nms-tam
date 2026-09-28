import { notFound } from "next/navigation";
import { format } from "date-fns";
import { ClipboardList } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import { resolveDateRange } from "@/lib/date-range";
import { addMonths, monthlyCost } from "@/servers/billing/pricing";
import { paymentsByRange } from "@/servers/billing/payment-stats";
import DateRangePicker from "@/components/dashboard/DateRangePicker";
import BillingStats from "@/components/dashboard/billing/BillingStats";
import PlanCard from "@/components/dashboard/billing/PlanCard";
import PaymentList from "@/components/dashboard/billing/PaymentList";
import PaymentsChart from "@/components/dashboard/billing/PaymentsChart";
import SubscriptionControls from "@/components/dashboard/admin/SubscriptionControls";
import ResolveRequestButtons from "@/components/dashboard/admin/ResolveRequestButtons";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OrganizationService } from "@/servers/services/organization.service";
import { PaymentService } from "@/servers/services/payment.service";
import { PlanService } from "@/servers/services/plan.service";
import { SubscriptionService } from "@/servers/services/subscription.service";
import { BillingRequestService } from "@/servers/services/billing-request.service";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ range?: string; from?: string; to?: string }>;
};

// Mirrors the client's own Billing page (plan + usage tiles, paid-period card, payments chart and history) with
// the admin's subscription controls and request resolution mixed in instead of the client's request dialogs.
export default async function OrganizationBillingPage({ params, searchParams }: Props) {
  await requireAdmin();
  const id = Number((await params).id);
  const range = resolveDateRange({ range: "month", ...(await searchParams) });

  const org = await OrganizationService.getById(id);
  if (!org) notFound();

  const [ent, usage, plans, payments, requests] = await Promise.all([
    SubscriptionService.getEntitlements(id),
    SubscriptionService.usage(id),
    PlanService.list(),
    PaymentService.list({ orgId: id }),
    BillingRequestService.list({ orgId: id, status: "OPEN" }),
  ]);
  const sub = org.subscription;
  const activePlans = plans.filter((p) => p.isActive || p.id === sub?.planId);
  const planName = (pid: number | null) => plans.find((p) => p.id === pid)?.name ?? "a plan";

  const now = new Date();
  const paidRows = payments.filter((p) => !p.voidedAt);
  const cover = paidRows
    .filter((p) => p.coversFrom && p.coversUntil)
    .sort((a, b) => b.coversUntil!.getTime() - a.coversUntil!.getTime())[0];
  const periodEnd = sub?.currentPeriodEnd ?? now;
  const periodStart = cover?.coversFrom && cover.coversFrom < periodEnd ? cover.coversFrom : addMonths(periodEnd, -1);
  const span = periodEnd.getTime() - periodStart.getTime();
  const elapsedPct = Math.round(Math.min(1, Math.max(0, span > 0 ? (now.getTime() - periodStart.getTime()) / span : 1)) * 100);

  return (
    <div className="space-y-6">
      {sub ? (
        <div className="grid gap-4 lg:grid-cols-5">
          <BillingStats
            className="lg:col-span-2"
            planName={sub.plan.name}
            monthlyCost={monthlyCost(sub.plan, sub.extraSlots)}
            extraSlots={sub.extraSlots}
            live={ent.live}
            daysLeft={ent.daysLeft ?? 0}
            periodEnd={periodEnd}
            devices={{ used: usage.devices, limit: ent.deviceLimit }}
            users={{ used: usage.users, limit: ent.userLimit }}
          />
          <PlanCard
            className="lg:col-span-3"
            planName={sub.plan.name}
            status={ent.status}
            live={ent.live}
            priceMonthly={sub.plan.priceMonthly}
            extraSlots={sub.extraSlots}
            extraSlotPrice={sub.plan.extraSlotPrice}
            monthlyCost={monthlyCost(sub.plan, sub.extraSlots)}
            devicesInUse={usage.devices}
            minPollIntervalSec={sub.plan.minPollIntervalSec}
            period={{ start: periodStart, end: periodEnd }}
            elapsedPct={elapsedPct}
            daysLeft={ent.daysLeft ?? 0}
            actions={
              <SubscriptionControls
                orgId={id}
                orgStatus={org.status}
                hasSubscription
                planId={sub.planId}
                extraSlots={sub.extraSlots}
                plans={activePlans.map((p) => ({ id: p.id, name: p.name, priceMonthly: p.priceMonthly, maxDevices: p.maxDevices }))}
              />
            }
          />
        </div>
      ) : (
        <Card className="border-border/60">
          <CardContent className="space-y-4 py-10 text-center">
            <p className="text-xl font-medium">No plan yet</p>
            <p className="text-muted-foreground mx-auto max-w-sm text-sm">{ent.reason}</p>
            <div className="flex justify-center">
              <SubscriptionControls
                orgId={id}
                orgStatus={org.status}
                hasSubscription={false}
                planId={null}
                extraSlots={0}
                plans={activePlans.map((p) => ({ id: p.id, name: p.name, priceMonthly: p.priceMonthly, maxDevices: p.maxDevices }))}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {requests.length > 0 && (
        <Card className="border-border/60">
          <CardHeader className="flex flex-row items-center gap-2 space-y-0">
            <ClipboardList className="text-muted-foreground size-4" />
            <CardTitle className="text-base">Open requests</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {requests.map((r) => (
              <div key={r.id} className="bg-muted space-y-3 rounded-lg px-4 py-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    {r.kind === "EXTRA_SLOTS" ? `${r.slots} extra slots` : r.kind === "PLAN_CHANGE" ? `Change plan to ${planName(r.planId)}` : "Renewal"} by{" "}
                    {r.requestedBy.name ?? r.requestedBy.email}
                    {r.message && <span className="text-muted-foreground"> · “{r.message}”</span>}
                  </span>
                  <span className="text-muted-foreground text-xs whitespace-nowrap">{formatDate(r.createdAt)}</span>
                </div>
                <ResolveRequestButtons requestId={r.id} />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end">
        <DateRangePicker basePath={`/dashboard/admin/organizations/${id}/billing`} current={range} />
      </div>
      <PaymentsChart
        months={paymentsByRange(payments, range)}
        rangeLabel={range.preset === "custom" ? `${format(range.from, "d MMM yyyy")} – ${format(range.to, "d MMM yyyy")}` : range.label.toLowerCase()}
      />

      <PaymentList
        payments={payments.map((p) => ({
          id: p.id, receiptNumber: p.receiptNumber, kind: p.kind, amount: p.amount, method: p.method,
          paidAt: p.paidAt, reference: p.reference, coversUntil: p.coversUntil, voidedAt: p.voidedAt,
        }))}
      />
    </div>
  );
}
