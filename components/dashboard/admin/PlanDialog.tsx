"use client";

import { ReactNode, useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import z from "zod";
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
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import FormField from "../FormField";
import { createPlan, updatePlan } from "@/app/action/plan.action";
import { CreatePlanSchema } from "@/servers/validators/plan.validator";

type FormType = z.input<typeof CreatePlanSchema>;

type Props = {
  trigger: ReactNode;
  existing?: { id: number; values: FormType; locked: boolean };
};

export default function PlanDialog({ trigger, existing }: Props) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  // a plan with subscribers keeps its price and limits; only the name, order and visibility can change
  const locked = existing?.locked ?? false;

  const form = useForm<FormType>({
    resolver: zodResolver(CreatePlanSchema),
    defaultValues: existing?.values ?? {
      name: "",
      priceMonthly: 0,
      extraSlotPrice: 10_000,
      maxDevices: 25,
      maxUsers: 5,
      minPollIntervalSec: 30,
      sortOrder: 0,
      isActive: true,
    },
  });
  const errors = form.formState.errors;
  const num = { valueAsNumber: true } as const;

  function onSubmit(values: FormType) {
    startTransition(async () => {
      const r = existing
        ? await updatePlan(existing.id, locked ? { name: values.name, sortOrder: values.sortOrder, isActive: values.isActive } : values)
        : await createPlan(values);
      if (!r.ok) return void toast.error(r.error);
      toast.success(existing ? "Plan saved" : "Plan created");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{existing ? "Edit plan" : "New plan"}</DialogTitle>
          <DialogDescription>
            {locked
              ? "This plan has subscribers, so its price and limits are locked. Create a new plan to change them."
              : "Once a client subscribes, the price and limits of a plan can no longer change."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="mt-2 space-y-4">
          <FormField label="Name" htmlFor="name" error={errors.name?.message}>
            <Input id="name" {...form.register("name")} placeholder="e.g. Starter" />
          </FormField>

          <fieldset disabled={locked} className="grid grid-cols-2 gap-3">
            <FormField label="Price per month (Rp)" htmlFor="price" error={errors.priceMonthly?.message}>
              <Input id="price" type="number" {...form.register("priceMonthly", num)} />
            </FormField>
            <FormField label="Price per extra slot (Rp)" htmlFor="slotPrice" error={errors.extraSlotPrice?.message}>
              <Input id="slotPrice" type="number" {...form.register("extraSlotPrice", num)} />
            </FormField>
            <FormField label="Device slots" htmlFor="devices" error={errors.maxDevices?.message}>
              <Input id="devices" type="number" {...form.register("maxDevices", num)} />
            </FormField>
            <FormField label="Team members" htmlFor="users" error={errors.maxUsers?.message}>
              <Input id="users" type="number" {...form.register("maxUsers", num)} />
            </FormField>
            <FormField label="Fastest polling (s)" htmlFor="poll" error={errors.minPollIntervalSec?.message}>
              <Input id="poll" type="number" {...form.register("minPollIntervalSec", num)} />
            </FormField>
          </fieldset>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Sort order" htmlFor="sort">
              <Input id="sort" type="number" {...form.register("sortOrder", num)} />
            </FormField>
            <Controller
              name="isActive"
              control={form.control}
              render={({ field }) => (
                <div className="flex items-end gap-3 pb-2">
                  <Switch id="active" checked={field.value} onCheckedChange={field.onChange} />
                  <Label htmlFor="active">Available to sell</Label>
                </div>
              )}
            />
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? <Spinner /> : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
