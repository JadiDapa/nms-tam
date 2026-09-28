import { format } from "date-fns";
import { CircleSlash, Receipt, TrendingUp, Wallet } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { formatIDR } from "@/lib/format";
import { resolveDateRange } from "@/lib/date-range";
import PageHeader from "@/components/dashboard/PageHeader";
import { StatCard, StatGroup } from "@/components/dashboard/StatCard";
import DateRangePicker from "@/components/dashboard/DateRangePicker";
import PaymentList from "@/components/dashboard/billing/PaymentList";
import PaymentsChart from "@/components/dashboard/billing/PaymentsChart";
import { paymentsByRange } from "@/servers/billing/payment-stats";
import { PaymentService } from "@/servers/services/payment.service";

type Props = {
  searchParams: Promise<{ range?: string; from?: string; to?: string }>;
};

export default async function PaymentsPage({ searchParams }: Props) {
  await requireAdmin();
  const range = resolveDateRange({ range: "month", ...(await searchParams) });
  const payments = await PaymentService.list();

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const live = payments.filter((p) => !p.voidedAt);
  const thisMonth = live.filter((p) => p.paidAt >= monthStart);
  const voided = payments.filter((p) => p.voidedAt);
  const allTime = live.reduce((sum, p) => sum + p.amount, 0);

  return (
    <main className="w-full space-y-6">
      <PageHeader
        title="Payments"
        subtitle="Every payment you recorded. Record new ones from the client's page. Open a receipt to print it or void it."
      />

      <StatGroup className="lg:grid-cols-4">
        <StatCard
          label="Received this month"
          value={formatIDR(thisMonth.reduce((s, p) => s + p.amount, 0))}
          icon={TrendingUp}
          size="md"
          featured
          caption={`${thisMonth.length} payment${thisMonth.length === 1 ? "" : "s"}`}
        />
        <StatCard label="All-time received" value={formatIDR(allTime)} icon={Wallet} size="md" caption={`${live.length} payments total`} />
        <StatCard label="Receipts issued" value={payments.length} icon={Receipt} caption="all clients" />
        <StatCard
          label="Voided"
          value={voided.length}
          icon={CircleSlash}
          pill={voided.length > 0 ? { label: "Check history", tone: "gray" } : { label: "None", tone: "green" }}
        />
      </StatGroup>

      <div className="flex justify-end">
        <DateRangePicker basePath="/dashboard/admin/payments" current={range} />
      </div>
      <PaymentsChart
        months={paymentsByRange(payments, range)}
        rangeLabel={range.preset === "custom" ? `${format(range.from, "d MMM yyyy")} – ${format(range.to, "d MMM yyyy")}` : range.label.toLowerCase()}
      />

      <PaymentList
        showClient
        payments={payments.map((p) => ({
          id: p.id, receiptNumber: p.receiptNumber, orgName: p.org.name, kind: p.kind, amount: p.amount, method: p.method,
          paidAt: p.paidAt, reference: p.reference, coversUntil: p.coversUntil, voidedAt: p.voidedAt,
        }))}
      />
    </main>
  );
}
