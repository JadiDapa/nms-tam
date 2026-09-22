"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import ConfirmAction from "../ConfirmAction";
import FormField from "../FormField";
import { cancelSubscription, changePlan, setExtraSlots } from "@/app/action/billing.action";
import { updateOrganization } from "@/app/action/organization.action";
import { formatIDR } from "@/lib/format";

type Props = {
  orgId: number;
  orgStatus: "ACTIVE" | "SUSPENDED";
  hasSubscription: boolean;
  planId: number | null;
  extraSlots: number;
  plans: { id: number; name: string; priceMonthly: number; maxDevices: number }[];
};

// The admin's other tools for a client's subscription (payments are recorded with the payment dialog).
export default function SubscriptionControls({ orgId, orgStatus, hasSubscription, planId, extraSlots, plans }: Props) {
  const [planOpen, setPlanOpen] = useState(false);
  const [slotsOpen, setSlotsOpen] = useState(false);
  const [newPlan, setNewPlan] = useState<string>("");
  const [slots, setSlots] = useState(String(extraSlots));
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function submit(fn: () => Promise<{ ok: true; data: unknown } | { ok: false; error: string }>, done: () => void, message: string) {
    startTransition(async () => {
      const r = await fn();
      if (!r.ok) return void toast.error(r.error);
      toast.success(message);
      done();
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {hasSubscription && (
        <>
          <Dialog open={planOpen} onOpenChange={setPlanOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">Change plan</Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Change plan</DialogTitle>
                <DialogDescription>Applies immediately. It is refused if the client uses more than the new plan allows. The new price applies from their next payment.</DialogDescription>
              </DialogHeader>
              <FormField label="New plan">
                <Select value={newPlan} onValueChange={setNewPlan}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a plan" />
                  </SelectTrigger>
                  <SelectContent>
                    {plans.filter((p) => p.id !== planId).map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        {p.name}: {p.maxDevices} devices, {formatIDR(p.priceMonthly)}/month
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
              <DialogFooter>
                <Button variant="outline" onClick={() => setPlanOpen(false)}>Cancel</Button>
                <Button disabled={!newPlan || isPending} onClick={() => submit(() => changePlan(orgId, Number(newPlan)), () => setPlanOpen(false), "Plan changed")}>
                  {isPending ? <Spinner /> : "Change plan"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={slotsOpen} onOpenChange={setSlotsOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">Set extra slots</Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Set extra slots</DialogTitle>
                <DialogDescription>Sets the number of bought slots directly, without a payment. Use it to remove slots or to correct a mistake. To sell slots, record an “Extra slots” payment instead.</DialogDescription>
              </DialogHeader>
              <FormField label="Extra slots">
                <Input type="number" min={0} value={slots} onChange={(e) => setSlots(e.target.value)} />
              </FormField>
              <DialogFooter>
                <Button variant="outline" onClick={() => setSlotsOpen(false)}>Cancel</Button>
                <Button disabled={isPending} onClick={() => submit(() => setExtraSlots(orgId, Number(slots)), () => setSlotsOpen(false), "Slots updated")}>
                  {isPending ? <Spinner /> : "Save"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <ConfirmAction
            trigger={<Button variant="outline" size="sm" className="text-destructive">Cancel subscription</Button>}
            title="Cancel this subscription?"
            description="The client becomes read-only and their devices are paused. Their data is kept. Recording a new activation payment restarts it."
            confirmLabel="Cancel subscription"
            destructive
            successMessage="Subscription canceled"
            onConfirm={() => cancelSubscription(orgId)}
          />
        </>
      )}

      <ConfirmAction
        trigger={<Button variant="outline" size="sm">{orgStatus === "ACTIVE" ? "Suspend client" : "Reinstate client"}</Button>}
        title={orgStatus === "ACTIVE" ? "Suspend this client?" : "Reinstate this client?"}
        description={
          orgStatus === "ACTIVE"
            ? "They stay signed in but everything becomes read-only and monitoring is paused until you reinstate them."
            : "Monitoring resumes for devices we paused, and the client can make changes again (if the subscription is active)."
        }
        confirmLabel={orgStatus === "ACTIVE" ? "Suspend" : "Reinstate"}
        destructive={orgStatus === "ACTIVE"}
        successMessage={orgStatus === "ACTIVE" ? "Client suspended" : "Client reinstated"}
        onConfirm={() => updateOrganization(orgId, { status: orgStatus === "ACTIVE" ? "SUSPENDED" : "ACTIVE" })}
      />
    </div>
  );
}
