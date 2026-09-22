"use client";

import { ReactNode, useState, useTransition } from "react";
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
import { createBillingRequest } from "@/app/action/billing.action";
import { CreateBillingRequestSchema } from "@/servers/validators/billing-request.validator";
import { formatIDR } from "@/lib/format";
import z from "zod";

type FormType = z.input<typeof CreateBillingRequestSchema>;
type Kind = FormType["kind"];

type Props = {
  trigger: ReactNode;
  initialKind: Kind;
  plans: { id: number; name: string; priceMonthly: number; maxDevices: number }[];
  extraSlotPrice: number;
};

const TITLES: Record<Kind, string> = {
  EXTRA_SLOTS: "Request more device slots",
  PLAN_CHANGE: "Request a plan change",
  RENEWAL: "Request a renewal",
};

// A client cannot change their own plan or slots: they ask, an admin records the payment and applies it.
export default function BillingRequestDialog({ trigger, initialKind, plans, extraSlotPrice }: Props) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const form = useForm<FormType>({
    resolver: zodResolver(CreateBillingRequestSchema),
    defaultValues: { kind: initialKind, slots: 5, message: "" },
  });
  const slots = useWatch({ control: form.control, name: "slots" });
  const errors = form.formState.errors;

  function onSubmit(values: FormType) {
    startTransition(async () => {
      const r = await createBillingRequest({
        kind: values.kind,
        planId: values.kind === "PLAN_CHANGE" ? values.planId : undefined,
        slots: values.kind === "EXTRA_SLOTS" ? values.slots : undefined,
        message: values.message,
      });
      if (!r.ok) return void toast.error(r.error);
      toast.success("Request sent. We will contact you about payment.");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{TITLES[initialKind]}</DialogTitle>
          <DialogDescription>Nothing changes until your payment is recorded by an administrator.</DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="mt-2 space-y-4">
          {initialKind === "EXTRA_SLOTS" && (
            <FormField
              label="Extra slots"
              htmlFor="slots"
              error={errors.slots?.message}
              hint={typeof slots === "number" && slots > 0 ? `${formatIDR(slots * extraSlotPrice)} per month for ${slots} slot${slots > 1 ? "s" : ""}` : `${formatIDR(extraSlotPrice)} per slot per month`}
            >
              <Input id="slots" type="number" min={1} {...form.register("slots", { valueAsNumber: true })} />
            </FormField>
          )}

          {initialKind === "PLAN_CHANGE" && (
            <Controller
              name="planId"
              control={form.control}
              render={({ field }) => (
                <FormField label="New plan" error={errors.planId?.message}>
                  <Select value={field.value ? String(field.value) : ""} onValueChange={(v) => field.onChange(Number(v))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a plan" />
                    </SelectTrigger>
                    <SelectContent>
                      {plans.map((p) => (
                        <SelectItem key={p.id} value={String(p.id)}>
                          {p.name}: {p.maxDevices} devices, {formatIDR(p.priceMonthly)}/month
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormField>
              )}
            />
          )}

          <FormField label="Message" htmlFor="message" optional>
            <Textarea id="message" {...form.register("message")} placeholder="Anything we should know?" />
          </FormField>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? <Spinner /> : "Send request"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
