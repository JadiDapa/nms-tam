import Link from "next/link";
import { CalendarClock, CheckCheck, Hourglass, Inbox } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { formatDate, timeAgo } from "@/lib/format";
import PageHeader from "@/components/dashboard/PageHeader";
import { StatCard, StatGroup } from "@/components/dashboard/StatCard";
import ResolveRequestButtons from "@/components/dashboard/admin/ResolveRequestButtons";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { BillingRequestService } from "@/servers/services/billing-request.service";
import { PlanService } from "@/servers/services/plan.service";

const KIND_LABEL: Record<string, string> = { EXTRA_SLOTS: "Extra slots", PLAN_CHANGE: "Plan change", RENEWAL: "Renewal" };

export default async function RequestsPage() {
  await requireAdmin();
  const [requests, plans] = await Promise.all([BillingRequestService.list(), PlanService.list()]);
  const open = [...requests.filter((r) => r.status === "OPEN")].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const closed = requests.filter((r) => r.status !== "OPEN");
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const resolvedThisMonth = closed.filter((r) => r.resolvedAt && r.resolvedAt >= monthStart).length;
  const planName = (id: number | null) => plans.find((p) => p.id === id)?.name ?? "a plan";

  const describe = (r: (typeof requests)[number]) =>
    r.kind === "EXTRA_SLOTS" ? `${r.slots} extra device slots` : r.kind === "PLAN_CHANGE" ? `Change plan to ${planName(r.planId)}` : "Renew the subscription";

  return (
    <main className="w-full space-y-6">
      <PageHeader
        title="Requests"
        subtitle="What clients asked for. Contact them about payment, record it on their page, then mark the request done."
      />

      <StatGroup className="lg:grid-cols-4">
        <StatCard
          label="Open requests"
          value={open.length}
          icon={Inbox}
          featured
          pill={open.length > 0 ? { label: "Waiting on you", tone: "yellow" } : { label: "All clear", tone: "green" }}
        />
        <StatCard
          label="Oldest open"
          value={open.length > 0 ? timeAgo(open[0].createdAt).replace(" ago", "") : "—"}
          icon={Hourglass}
          caption={open.length > 0 ? open[0].org.name : "nothing waiting"}
        />
        <StatCard label="Resolved this month" value={resolvedThisMonth} icon={CheckCheck} caption="requests closed" />
        <StatCard label="All-time requests" value={requests.length} icon={CalendarClock} caption="ever received" />
      </StatGroup>

      <div className="space-y-3">
        <h2 className="text-foreground text-lg font-semibold">Open <span className="text-muted-foreground font-normal">({open.length})</span></h2>
        <div className="flex flex-col gap-2">
          {open.map((r) => (
            <div key={r.id} className="bg-card border-border/60 space-y-3 rounded-xl border p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{describe(r)}</p>
                    <StatusBadge label={KIND_LABEL[r.kind] ?? r.kind} tone="blue" />
                  </div>
                  <p className="text-muted-foreground mt-0.5 text-xs">
                    <Link href={`/dashboard/admin/organizations/${r.orgId}`} className="hover:text-foreground underline underline-offset-4">
                      {r.org.name}
                    </Link>{" "}
                    · {r.requestedBy.name ?? r.requestedBy.email} · {formatDate(r.createdAt)} ({timeAgo(r.createdAt)})
                  </p>
                  {r.message && <p className="bg-muted mt-2 rounded-lg px-3 py-2 text-sm">“{r.message}”</p>}
                </div>
              </div>
              <ResolveRequestButtons requestId={r.id} />
            </div>
          ))}
          {open.length === 0 && (
            <div className="text-muted-foreground flex flex-col items-center gap-2 py-12 text-center text-sm">
              <CheckCheck className="text-muted-foreground/50 size-8" />
              Nothing waiting on you right now.
            </div>
          )}
        </div>
      </div>

      {closed.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-foreground text-lg font-semibold">Handled</h2>
          <ul className="bg-card divide-y rounded-lg border text-sm">
            {closed.slice(0, 50).map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
                <span>
                  <Link href={`/dashboard/admin/organizations/${r.orgId}`} className="hover:underline">
                    {r.org.name}
                  </Link>
                  : {describe(r)}
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
