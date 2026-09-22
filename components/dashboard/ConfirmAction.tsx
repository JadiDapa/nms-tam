"use client";

import { ReactNode, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import type { ActionResult } from "@/lib/action";

type Props = {
  trigger: ReactNode;
  title: string;
  description: string;
  confirmLabel?: string;
  successMessage?: string;
  destructive?: boolean;
  onConfirm: () => Promise<ActionResult<unknown>>;
  // where to go after success (default: stay and refresh)
  redirectTo?: string;
};

// A button that asks "are you sure?" before running a server action, then shows the real result.
export default function ConfirmAction({
  trigger,
  title,
  description,
  confirmLabel = "Confirm",
  successMessage = "Done",
  destructive,
  onConfirm,
  redirectTo,
}: Props) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handle() {
    startTransition(async () => {
      const result = await onConfirm();
      if (!result.ok) return void toast.error(result.error);
      toast.success(successMessage);
      setOpen(false);
      if (redirectTo) router.push(redirectTo);
      else router.refresh();
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <Button variant={destructive ? "destructive" : "default"} onClick={handle} disabled={isPending}>
            {isPending ? <Spinner /> : confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
