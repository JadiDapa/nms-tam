import Link from "next/link";
import { format } from "date-fns";
import { Building2, CalendarDays, Inbox, Receipt, TriangleAlert } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import PageHeader from "../PageHeader";
import { StatCard, StatGroup } from "../StatCard";
import { StatusBadge } from "../StatusBadge";
import { formatDate, formatIDR } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { BillingRequestService } from "@/servers/services/billing-request.service";
import { EngineAdminService } from "@/servers/services/engine-admin.service";

const DAY = 24 * 60 * 60 * 1000;

export default async function AdminOverview() {
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  const [orgs, openRequests, revenue, engine] = await Promise.all([
    prisma.organization.findMany({ include: { subscription: { include: { plan: true } } } }),
    BillingRequestService.countOpen(),
    prisma.payment.aggregate({ _sum: { amount: true }, _count: { _all: true }, where: { voidedAt: null, paidAt: { gte: monthStart } } }),
    EngineAdminService.health(),
  ]);

  const live = (o: (typeof orgs)[number]) =>
    o.status === "ACTIVE" && o.subscription?.status === "ACTIVE" && o.subscription.currentPeriodEnd > now;
  const active = orgs.filter(live);
  const noPlan = orgs.filter((o) => !o.subscription);
  const expired = orgs.filter((o) => o.subscription && !live(o) && o.status === "ACTIVE");
  const expiringSoon = active
    .filter((o) => o.subscription!.currentPeriodEnd.getTime() - now.getTime() < 7 * DAY)
    .sort((a, b) => a.subscription!.currentPeriodEnd.getTime() - b.subscription!.currentPeriodEnd.getTime());

  const attention = expired.length + noPlan.length;
  const activePct = orgs.length > 0 ? Math.round((active.length / orgs.length) * 100) : null;
  const statCards = [
    {
      label: "Active clients",
      value: active.length,
      pill: activePct === null ? undefined : { label: `${activePct}%`, tone: "green" as const, arrow: "up" as const },
      caption: `of ${orgs.length} clients`,
      icon: Building2,
      featured: true,
    },
    {
      label: "Expired / no plan",
      value: attention,
      pill: attention > 0 ? { label: "Follow up", tone: "yellow" as const, arrow: "down" as const } : { label: "All good", tone: "green" as const },
      caption: `${expired.length} expired, ${noPlan.length} no plan`,
      icon: TriangleAlert,
    },
    {
      label: "Received this month",
      value: formatIDR(revenue._sum.amount ?? 0),
      pill: { label: `${revenue._count._all} payment${revenue._count._all === 1 ? "" : "s"}`, tone: "green" as const },
      caption: "this month",
      icon: Receipt,
    },
    {
      label: "Open requests",
      value: openRequests,
      pill: openRequests > 0 ? { label: "Waiting", tone: "yellow" as const } : { label: "All handled", tone: "green" as const },
      caption: "for you",
      icon: Inbox,
    },
  ];

  return (
    <main className="w-full space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader title="Dashboard" subtitle="Clients, billing and the monitoring engine." />
        <div className="text-muted-foreground flex items-center gap-1.5 text-sm">
          <CalendarDays className="size-4" />
          {format(now, "dd MMMM yyyy")}
        </div>
      </div>

      <StatGroup className="lg:grid-cols-4">
        {statCards.map((s) => (
          <StatCard key={s.label} {...s} />
        ))}
      </StatGroup>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          <h2 className="text-foreground text-lg font-semibold">Expiring within 7 days</h2>
          <div className="flex flex-col gap-2">
            {expiringSoon.map((o) => (
              <Link key={o.id} href={`/dashboard/admin/organizations/${o.id}`}>
                <div className="border-border/60 bg-card hover:bg-accent/30 flex items-center justify-between rounded-xl border px-4 py-3 transition-colors">
                  <div>
                    <p className="text-sm font-medium">{o.name}</p>
                    <p className="text-muted-foreground text-xs">{o.subscription!.plan.name}</p>
                  </div>
                  <StatusBadge label={`ends ${formatDate(o.subscription!.currentPeriodEnd)}`} tone="yellow" />
                </div>
              </Link>
            ))}
            {expiringSoon.length === 0 && <p className="text-muted-foreground py-8 text-center text-sm">No subscription ends within a week.</p>}
          </div>
        </div>

        <Card className="border-border/60 h-fit">
          <CardContent className="space-y-3 p-5 text-sm">
            <div className="flex items-center justify-between">
              <p className="font-medium">Monitoring engine</p>
              <StatusBadge label={engine.ok ? "ONLINE" : "UNREACHABLE"} tone={engine.ok ? "green" : "red"} />
            </div>
            {engine.ok && (
              <p className="text-muted-foreground">
                version {engine.health.version}, up {Math.round(engine.health.uptimeSec / 60)} min
              </p>
            )}
            <Link href="/dashboard/admin/engine" className="text-muted-foreground hover:text-foreground block transition-colors">
              Engine details →
            </Link>
            <Link href="/dashboard/admin/simulate" className="text-muted-foreground hover:text-foreground block transition-colors">
              Simulate historical data →
            </Link>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
