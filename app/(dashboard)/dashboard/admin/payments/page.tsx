import { requireAdmin } from "@/lib/auth";
import PageHeader from "@/components/dashboard/PageHeader";
import PaymentList from "@/components/dashboard/billing/PaymentList";
import { PaymentService } from "@/servers/services/payment.service";

export default async function PaymentsPage() {
  await requireAdmin();
  const payments = await PaymentService.list();

  return (
    <main className="w-full space-y-6">
      <PageHeader
        title="Payments"
        subtitle="Every payment you recorded. Record new ones from the client's page. Open a receipt to print it or void it."
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
