import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { formatDate, formatIDR } from "@/lib/format";
import PrintButton from "@/components/dashboard/billing/PrintButton";
import VoidPaymentButton from "@/components/dashboard/admin/VoidPaymentButton";
import { PaymentService } from "@/servers/services/payment.service";

type Props = {
  params: Promise<{ id: string }>;
};

const KIND_LABEL: Record<string, string> = {
  ACTIVATION: "Plan activation",
  RENEWAL: "Renewal",
  EXTRA_SLOTS: "Extra device slots",
  ADJUSTMENT: "Adjustment",
};

const Row = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="flex justify-between gap-6 border-b py-2 text-sm last:border-b-0">
    <span className="text-muted-foreground">{label}</span>
    <span className="text-right font-medium">{children}</span>
  </div>
);

// The billing package of one payment: printable, and identical for the client and for us.
export default async function ReceiptPage({ params }: Props) {
  const user = await requireUser();
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();

  const payment = await PaymentService.getById(id);
  // a client can only open their own receipts; anything else looks like it does not exist
  if (!payment || (user.role !== "ADMIN" && payment.orgId !== user.orgId)) notFound();

  return (
    <main className="mx-auto w-full max-w-2xl space-y-4">
      <div className="flex justify-end gap-2 print:hidden">
        {user.role === "ADMIN" && !payment.voidedAt && <VoidPaymentButton paymentId={payment.id} />}
        <PrintButton />
      </div>

      <div className="bg-card relative space-y-5 rounded-lg border p-8">
        {payment.voidedAt && (
          <div className="text-destructive border-destructive/40 absolute end-6 top-6 rotate-6 rounded border-2 px-3 py-1 text-lg font-bold tracking-widest">
            VOID
          </div>
        )}

        <div>
          <p className="text-muted-foreground text-xs tracking-widest uppercase">Payment receipt</p>
          <h1 className="text-2xl font-bold">{payment.receiptNumber}</h1>
        </div>

        <div>
          <Row label="Client">{payment.org.name}</Row>
          <Row label="For">{KIND_LABEL[payment.kind] ?? payment.kind}</Row>
          <Row label="Plan">
            {payment.planName} ({formatIDR(payment.planPrice)}/month)
          </Row>
          {payment.extraSlots > 0 && (
            <Row label="Extra slots">
              {payment.extraSlots} × {formatIDR(payment.extraSlotPrice)}/month
            </Row>
          )}
          {payment.months > 0 && <Row label="Months paid">{payment.months}</Row>}
          {payment.coversUntil && (
            <Row label="Covers">
              {formatDate(payment.coversFrom)} to {formatDate(payment.coversUntil)}
            </Row>
          )}
          <Row label="Amount paid">
            <span className="text-lg">{formatIDR(payment.amount)}</span>
          </Row>
          <Row label="Paid on">{formatDate(payment.paidAt)}</Row>
          <Row label="Method">{payment.method.replace("_", " ").toLowerCase()}</Row>
          <Row label="Reference">{payment.reference}</Row>
          {payment.evidenceUrl && (
            <Row label="Evidence">
              <a href={payment.evidenceUrl} target="_blank" rel="noreferrer noopener" className="underline underline-offset-4 print:no-underline">
                {payment.evidenceUrl}
              </a>
            </Row>
          )}
          {payment.note && <Row label="Note">{payment.note}</Row>}
          {payment.voidedAt && (
            <Row label="Voided">
              {formatDate(payment.voidedAt)}: {payment.voidReason}
            </Row>
          )}
        </div>

        <p className="text-muted-foreground text-xs">Recorded by {payment.recordedBy.name ?? payment.recordedBy.email} on {formatDate(payment.createdAt)}.</p>
      </div>
    </main>
  );
}
