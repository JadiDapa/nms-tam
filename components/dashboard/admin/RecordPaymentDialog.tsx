"use client";

import { ReactNode, useEffect, useState, useTransition } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import FormField from "../FormField";
import { recordPayment } from "@/app/action/billing.action";
import { RecordPaymentSchema, type RecordPaymentInput } from "@/servers/validators/payment.validator";
import { formatDate, formatIDR } from "@/lib/format";
import { monthlyCost, suggestExtraSlotsAmount, suggestRenewalAmount } from "@/servers/billing/pricing";

type Plan = { id: number; name: string; priceMonthly: number; extraSlotPrice: number };

export type SubscriptionSummary = {
  planId: number;
  status: string;
  live: boolean;
  extraSlots: number;
  currentPeriodEnd: string;
  plan: Plan;
};

type Props = {
  orgId: number;
  plans: Plan[];
  subscription: SubscriptionSummary | null;
  trigger: ReactNode;
};

const KIND_LABEL: Record<string, string> = {
  ACTIVATION: "Activate a plan (first payment)",
  RENEWAL: "Renewal (extend the paid period)",
  EXTRA_SLOTS: "Extra device slots",
  ADJUSTMENT: "Adjustment (bonus months or slots)",
};

const today = () => new Date().toISOString().slice(0, 10);

// Where the admin turns "I received a transfer" into a receipt and its effect. The amount is suggested from the plan
// prices but is always editable, because what was actually received is what counts.
export default function RecordPaymentDialog({ orgId, plans, subscription, trigger }: Props) {
  const [open, setOpen] = useState(false);
  const [amountTouched, setAmountTouched] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const fresh = subscription === null || subscription.status === "CANCELED";
  const kinds = fresh ? ["ACTIVATION"] : subscription.live ? ["RENEWAL", "EXTRA_SLOTS", "ADJUSTMENT"] : ["RENEWAL", "ADJUSTMENT"];

  const form = useForm<RecordPaymentInput>({
    resolver: zodResolver(RecordPaymentSchema),
    defaultValues: {
      orgId,
      kind: kinds[0] as RecordPaymentInput["kind"],
      planId: fresh ? plans[0]?.id : undefined,
      months: 1,
      slots: 0,
      amount: 0,
      method: "BANK_TRANSFER",
      paidAt: today(),
      reference: "",
      evidenceUrl: "",
      note: "",
    },
  });
  const v = useWatch({ control: form.control });
  const errors = form.formState.errors;

  // keep the suggested amount in step with the choices until the admin types their own
  useEffect(() => {
    if (amountTouched) return;
    const months = Number(v.months) || 0;
    const slots = Number(v.slots) || 0;
    let suggestion = 0;
    if (v.kind === "ACTIVATION") {
      const plan = plans.find((p) => p.id === v.planId);
      if (plan) suggestion = suggestRenewalAmount(plan, slots, months);
    } else if (v.kind === "RENEWAL" && subscription) {
      suggestion = suggestRenewalAmount(subscription.plan, subscription.extraSlots, months);
    } else if (v.kind === "EXTRA_SLOTS" && subscription) {
      suggestion = suggestExtraSlotsAmount({
        slots,
        slotPrice: subscription.plan.extraSlotPrice,
        currentPeriodEnd: new Date(subscription.currentPeriodEnd),
        now: new Date(),
      });
    }
    form.setValue("amount", suggestion);
  }, [v.kind, v.planId, v.months, v.slots, amountTouched, plans, subscription, form]);

  function onSubmit(values: RecordPaymentInput) {
    startTransition(async () => {
      const r = await recordPayment({
        ...values,
        planId: values.kind === "ACTIVATION" ? values.planId : undefined,
        months: values.kind === "EXTRA_SLOTS" ? 0 : values.months,
        slots: values.kind === "RENEWAL" ? 0 : values.slots,
      });
      if (!r.ok) return void toast.error(r.error);
      toast.success(
        `Receipt ${r.data.receiptNumber} recorded` +
          (r.data.devicesResumed > 0 ? `, ${r.data.devicesResumed} devices resumed` : "") +
          (r.data.syncFailed > 0 ? `. ${r.data.syncFailed} devices could not be resumed yet; they will be retried.` : ""),
      );
      setOpen(false);
      setAmountTouched(false);
      form.reset();
      router.refresh();
    });
  }

  const showMonths = v.kind !== "EXTRA_SLOTS";
  const showSlots = v.kind !== "RENEWAL";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Record a payment</DialogTitle>
          <DialogDescription>
            Records the money you received and applies it. A receipt is created for the client.
            {subscription && ` Currently paid until ${formatDate(subscription.currentPeriodEnd)}; ${formatIDR(monthlyCost(subscription.plan, subscription.extraSlots))}/month.`}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="mt-2 space-y-4">
          <Controller
            name="kind"
            control={form.control}
            render={({ field }) => (
              <FormField label="This payment is for">
                <Select
                  value={field.value}
                  onValueChange={(x) => {
                    field.onChange(x);
                    setAmountTouched(false);
                  }}
                  disabled={kinds.length === 1}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {kinds.map((k) => (
                      <SelectItem key={k} value={k}>
                        {KIND_LABEL[k]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
            )}
          />

          {v.kind === "ACTIVATION" && (
            <Controller
              name="planId"
              control={form.control}
              render={({ field }) => (
                <FormField label="Plan" error={errors.planId?.message}>
                  <Select value={field.value ? String(field.value) : ""} onValueChange={(x) => field.onChange(Number(x))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a plan" />
                    </SelectTrigger>
                    <SelectContent>
                      {plans.map((p) => (
                        <SelectItem key={p.id} value={String(p.id)}>
                          {p.name} ({formatIDR(p.priceMonthly)}/month)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>
              )}
            />
          )}

          <div className="grid grid-cols-2 gap-3">
            {showMonths && (
              <FormField label="Months paid" htmlFor="months" error={errors.months?.message}>
                <Input id="months" type="number" min={0} {...form.register("months", { valueAsNumber: true })} />
              </FormField>
            )}
            {showSlots && (
              <FormField
                label={v.kind === "ACTIVATION" ? "Extra slots included" : "Slots added"}
                htmlFor="slots"
                error={errors.slots?.message}
              >
                <Input id="slots" type="number" min={0} {...form.register("slots", { valueAsNumber: true })} />
              </FormField>
            )}
          </div>

          <FormField
            label="Amount received (Rp)"
            htmlFor="amount"
            error={errors.amount?.message}
            hint={amountTouched ? "Edited by you." : "Suggested from the plan prices. Change it to what was really received."}
          >
            <Input
              id="amount"
              type="number"
              min={0}
              {...form.register("amount", { valueAsNumber: true, onChange: () => setAmountTouched(true) })}
            />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <Controller
              name="method"
              control={form.control}
              render={({ field }) => (
                <FormField label="Method">
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="BANK_TRANSFER">Bank transfer</SelectItem>
                      <SelectItem value="CASH">Cash</SelectItem>
                      <SelectItem value="OTHER">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </FormField>
              )}
            />
            <FormField label="Paid on" htmlFor="paidAt" error={errors.paidAt?.message}>
              <Input id="paidAt" type="date" {...form.register("paidAt")} />
            </FormField>
          </div>

          <FormField label="Reference" htmlFor="reference" error={errors.reference?.message} hint="For example the transfer number or the sender name.">
            <Input id="reference" {...form.register("reference")} />
          </FormField>
          <FormField label="Evidence link" htmlFor="evidenceUrl" optional error={errors.evidenceUrl?.message} hint="A link to the proof, for example a shared image.">
            <Input id="evidenceUrl" placeholder="https://" {...form.register("evidenceUrl")} />
          </FormField>
          <FormField label="Note" htmlFor="note" optional>
            <Textarea id="note" {...form.register("note")} />
          </FormField>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? <Spinner /> : "Record payment"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
