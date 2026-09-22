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
import { Spinner } from "@/components/ui/spinner";
import FormField from "../FormField";
import { voidPayment } from "@/app/action/billing.action";

export default function VoidPaymentButton({ paymentId }: { paymentId: number }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function submit() {
    startTransition(async () => {
      const r = await voidPayment(paymentId, { reason });
      if (!r.ok) return void toast.error(r.error);
      toast.success("Payment voided");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="text-destructive">Void this payment</Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Void this payment?</DialogTitle>
          <DialogDescription>
            The receipt is marked VOID and stays on record. It does not undo the subscription change: if the period or slots
            were wrong, fix them explicitly afterwards.
          </DialogDescription>
        </DialogHeader>
        <FormField label="Reason">
          <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. entered twice" />
        </FormField>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="destructive" disabled={reason.trim().length < 3 || isPending} onClick={submit}>
            {isPending ? <Spinner /> : "Void payment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
