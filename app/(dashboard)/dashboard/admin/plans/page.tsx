import { Layers, Plus, Sparkles, Users as UsersIcon, Wallet } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { formatIDR } from "@/lib/format";
import { cn } from "@/lib/utils";
import PageHeader from "@/components/dashboard/PageHeader";
import { StatCard, StatGroup } from "@/components/dashboard/StatCard";
import PlanDialog from "@/components/dashboard/admin/PlanDialog";
import DeletePlanButton from "@/components/dashboard/admin/DeletePlanButton";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PlanService } from "@/servers/services/plan.service";

export default async function PlansPage() {
  await requireAdmin();
  const plans = await PlanService.list();

  const active = plans.filter((p) => p.isActive);
  const totalSubscribers = plans.reduce((s, p) => s + p._count.subscriptions, 0);
  const mostPopular = [...plans].sort((a, b) => b._count.subscriptions - a._count.subscriptions)[0];
  const maxDevices = plans.length > 0 ? Math.max(...plans.map((p) => p.maxDevices)) : 0;

  return (
    <main className="w-full space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <PageHeader title="Plans" subtitle="What you sell. A plan with subscribers keeps its price and limits." />
        <PlanDialog
          trigger={
            <Button>
              <Plus className="size-4" />
              New Plan
            </Button>
          }
        />
      </div>

      {plans.length > 0 && (
        <StatGroup className="lg:grid-cols-4">
          <StatCard label="Active plans" value={active.length} icon={Layers} featured caption={`${plans.length - active.length} hidden`} />
          <StatCard label="Total subscribers" value={totalSubscribers} icon={UsersIcon} caption="clients on a paid plan" />
          <StatCard
            label="Most popular"
            value={mostPopular && mostPopular._count.subscriptions > 0 ? mostPopular.name : "—"}
            icon={Sparkles}
            size="md"
            caption={mostPopular && mostPopular._count.subscriptions > 0 ? `${mostPopular._count.subscriptions} subscriber${mostPopular._count.subscriptions === 1 ? "" : "s"}` : "no subscribers yet"}
          />
          <StatCard label="Largest tier" value={`${maxDevices} slots`} icon={Wallet} caption="top device quota" />
        </StatGroup>
      )}

      <div className="bg-card rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="ps-5">PLAN</TableHead>
              <TableHead>PRICE / MONTH</TableHead>
              <TableHead>SLOTS</TableHead>
              <TableHead>EXTRA SLOT</TableHead>
              <TableHead>USERS</TableHead>
              <TableHead>POLLING</TableHead>
              <TableHead>CLIENTS</TableHead>
              <TableHead>ACTIONS</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {plans.map((p) => {
              const subscribers = p._count.subscriptions;
              return (
                <TableRow key={p.id} className={p.isActive ? undefined : "opacity-60"}>
                  <TableCell className="ps-5">
                    <span className={cn("font-medium", p.id === mostPopular?.id && subscribers > 0 && "inline-flex items-center gap-1.5")}>
                      {p.name}
                      {p.id === mostPopular?.id && subscribers > 0 && <Sparkles className="text-primary size-3.5" />}
                    </span>
                    {!p.isActive && <StatusBadge label="HIDDEN" tone="gray" className="ms-2" />}
                  </TableCell>
                  <TableCell className="font-mono text-sm tabular-nums">{formatIDR(p.priceMonthly)}</TableCell>
                  <TableCell className="text-sm">{p.maxDevices}</TableCell>
                  <TableCell className="font-mono text-sm tabular-nums">{formatIDR(p.extraSlotPrice)}</TableCell>
                  <TableCell className="text-sm">{p.maxUsers}</TableCell>
                  <TableCell className="text-sm">≥ {p.minPollIntervalSec} s</TableCell>
                  <TableCell className="text-sm">{subscribers}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <PlanDialog
                        existing={{
                          id: p.id,
                          locked: subscribers > 0,
                          values: {
                            name: p.name, priceMonthly: p.priceMonthly, extraSlotPrice: p.extraSlotPrice, maxDevices: p.maxDevices,
                            maxUsers: p.maxUsers, minPollIntervalSec: p.minPollIntervalSec, sortOrder: p.sortOrder, isActive: p.isActive,
                          },
                        }}
                        trigger={<Button variant="outline" size="sm" className="h-7">Edit</Button>}
                      />
                      {subscribers === 0 && <DeletePlanButton planId={p.id} />}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        {plans.length === 0 && <p className="text-muted-foreground py-16 text-center text-sm">No plans yet. Create one to start selling.</p>}
      </div>
    </main>
  );
}
