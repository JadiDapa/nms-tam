import { Plus } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { formatIDR } from "@/lib/format";
import PageHeader from "@/components/dashboard/PageHeader";
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
                    <span className="font-medium">{p.name}</span>
                    {!p.isActive && <StatusBadge label="HIDDEN" tone="gray" className="ms-2" />}
                  </TableCell>
                  <TableCell className="text-sm">{formatIDR(p.priceMonthly)}</TableCell>
                  <TableCell className="text-sm">{p.maxDevices}</TableCell>
                  <TableCell className="text-sm">{formatIDR(p.extraSlotPrice)}</TableCell>
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
