import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { formatDate } from "@/lib/format";
import PageHeader from "@/components/dashboard/PageHeader";
import ResolveRequestButtons from "@/components/dashboard/admin/ResolveRequestButtons";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { BillingRequestService } from "@/servers/services/billing-request.service";
import { PlanService } from "@/servers/services/plan.service";

export default async function RequestsPage() {
  await requireAdmin();
  const [requests, plans] = await Promise.all([BillingRequestService.list(), PlanService.list()]);
  const open = requests.filter((r) => r.status === "OPEN");
  const closed = requests.filter((r) => r.status !== "OPEN");
  const planName = (id: number | null) => plans.find((p) => p.id === id)?.name ?? "a plan";

  const describe = (r: (typeof requests)[number]) =>
    r.kind === "EXTRA_SLOTS" ? `${r.slots} extra device slots` : r.kind === "PLAN_CHANGE" ? `Change plan to ${planName(r.planId)}` : "Renew the subscription";

  return (
    <main className="w-full space-y-6">
      <PageHeader
        title="Requests"
        subtitle="What clients asked for. Contact them about payment, record it on their page, then mark the request done."
      />

      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Open ({open.length})</h2>
        {open.map((r) => (
          <div key={r.id} className="bg-card space-y-3 rounded-lg border p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-medium">{describe(r)}</p>
                <p className="text-muted-foreground text-xs">
                  <Link href={`/dashboard/admin/organizations/${r.orgId}`} className="underline underline-offset-4">
                    {r.org.name}
                  </Link>{" "}
                  · {r.requestedBy.name ?? r.requestedBy.email} · {formatDate(r.createdAt)}
                </p>
                {r.message && <p className="mt-1 text-sm">“{r.message}”</p>}
              </div>
            </div>
            <ResolveRequestButtons requestId={r.id} />
          </div>
        ))}
        {open.length === 0 && <p className="text-muted-foreground py-8 text-center text-sm">No open requests.</p>}
      </div>

      {closed.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Handled</h2>
          <ul className="bg-card divide-y rounded-lg border text-sm">
            {closed.slice(0, 50).map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2">
                <span>
                  {r.org.name}: {describe(r)}
                  {r.adminNote && <span className="text-muted-foreground"> · {r.adminNote}</span>}
                </span>
                <span className="flex items-center gap-2">
                  <StatusBadge label={r.status} tone={r.status === "DONE" ? "green" : "gray"} />
                  <span className="text-muted-foreground text-xs">{formatDate(r.resolvedAt)}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </main>
  );
}
