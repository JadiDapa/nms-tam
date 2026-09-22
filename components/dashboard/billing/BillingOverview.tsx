import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { addMonths, monthlyCost } from "@/servers/billing/pricing";
import { paymentsByMonth } from "@/servers/billing/payment-stats";
import { BillingRequestService } from "@/servers/services/billing-request.service";
import { PaymentService } from "@/servers/services/payment.service";
import { PlanService } from "@/servers/services/plan.service";
import { SubscriptionService } from "@/servers/services/subscription.service";
import PageHeader from "../PageHeader";
import BillingRequestDialog from "./BillingRequestDialog";
import BillingStats from "./BillingStats";
import PaymentList from "./PaymentList";
import PaymentsChart from "./PaymentsChart";
import PlanCard from "./PlanCard";
import RequestsCard from "./RequestsCard";

// The client's billing page: plan and usage on top, payments and requests in the middle, the full history below.
export default async function BillingOverview({ orgId }: { orgId: number }) {
  const [ent, usage, sub, plans, payments, requests] = await Promise.all([
    SubscriptionService.getEntitlements(orgId),
    SubscriptionService.usage(orgId),
    SubscriptionService.getByOrg(orgId),
    PlanService.list({ activeOnly: true }),
    PaymentService.list({ orgId }),
    BillingRequestService.list({ orgId }),
  ]);

  const now = new Date();
  const paidRows = payments.filter((p) => !p.voidedAt);

  // The paid period runs from when the latest payment starts covering to the paid-until date.
  const cover = paidRows
    .filter((p) => p.coversFrom && p.coversUntil)
    .sort((a, b) => b.coversUntil!.getTime() - a.coversUntil!.getTime())[0];
  const periodEnd = sub?.currentPeriodEnd ?? now;
  const periodStart = cover?.coversFrom && cover.coversFrom < periodEnd ? cover.coversFrom : addMonths(periodEnd, -1);

  const span = periodEnd.getTime() - periodStart.getTime();
  const elapsedPct = Math.round(Math.min(1, Math.max(0, span > 0 ? (now.getTime() - periodStart.getTime()) / span : 1)) * 100);

  const cost = sub ? monthlyCost(sub.plan, sub.extraSlots) : 0;
  const extraSlotPrice = sub?.plan.extraSlotPrice ?? 0;

  return (
    <main className="w-full space-y-6">
      <PageHeader title="Billing" subtitle="Your plan, what you use, and your payment history." />

      {sub ? (
        <div className="grid gap-4 lg:grid-cols-5">
          <BillingStats
            className="lg:col-span-2"
            planName={sub.plan.name}
            monthlyCost={cost}
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
            extraSlotPrice={extraSlotPrice}
            monthlyCost={cost}
            devicesInUse={usage.devices}
            minPollIntervalSec={sub.plan.minPollIntervalSec}
            period={{ start: periodStart, end: periodEnd }}
            elapsedPct={elapsedPct}
            daysLeft={ent.daysLeft ?? 0}
            actions={
              <>
                <BillingRequestDialog
                  initialKind="EXTRA_SLOTS"
                  plans={plans}
                  extraSlotPrice={extraSlotPrice}
                  trigger={<Button className="rounded-xl">Request more slots</Button>}
                />
                <BillingRequestDialog
                  initialKind="PLAN_CHANGE"
                  plans={plans.filter((p) => p.id !== sub.planId)}
                  extraSlotPrice={extraSlotPrice}
                  trigger={<Button variant="outline" className="rounded-xl">Change plan</Button>}
                />
                <BillingRequestDialog
                  initialKind="RENEWAL"
                  plans={plans}
                  extraSlotPrice={extraSlotPrice}
                  trigger={<Button variant="outline" className="rounded-xl">Request renewal</Button>}
                />
              </>
            }
          />
        </div>
      ) : (
        <Card>
          <CardContent className="py-10 text-center">
            <p className="text-xl font-medium">No plan yet</p>
            <p className="text-muted-foreground mt-2 text-sm">{ent.reason}</p>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-5">
        <PaymentsChart className="lg:col-span-3" months={paymentsByMonth(payments, 6, now)} />
        <RequestsCard className="lg:col-span-2" requests={requests} />
      </div>

      <PaymentList
        title="Payment history"
        description="Every payment recorded for your account. Open a receipt to view or print it."
        payments={payments.map((p) => ({
          id: p.id,
          receiptNumber: p.receiptNumber,
          kind: p.kind,
          amount: p.amount,
          method: p.method,
          paidAt: p.paidAt,
          reference: p.reference,
          coversUntil: p.coversUntil,
          voidedAt: p.voidedAt,
        }))}
      />
    </main>
  );
}
