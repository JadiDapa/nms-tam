"use client";

import { ReactNode, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
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
import { Spinner } from "@/components/ui/spinner";
import FormField from "../FormField";
import { createDeviceGroup } from "@/app/action/device-group.action";
import { DeviceGroupSchema, type DeviceGroupInput } from "@/servers/validators/monitoring.validator";

type Props = {
  trigger: ReactNode;
  onCreated?: (group: { id: number; name: string }) => void;
};

// A one-field dialog for adding a device group on the fly, from the wizard's select or the device list page.
export default function GroupDialog({ trigger, onCreated }: Props) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const form = useForm<DeviceGroupInput>({
    resolver: zodResolver(DeviceGroupSchema),
    defaultValues: { name: "" },
  });
  const errors = form.formState.errors;

  function onSubmit(values: DeviceGroupInput) {
    startTransition(async () => {
      const result = await createDeviceGroup(values);
      if (!result.ok) return void toast.error(result.error);
      toast.success("Group created");
      form.reset();
      setOpen(false);
      onCreated?.(result.data);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => (setOpen(v), !v && form.reset())}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>New group</DialogTitle>
          <DialogDescription>Groups are just a label for organizing devices, e.g. by site or area.</DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="mt-2 space-y-4">
          <FormField label="Group name" htmlFor="group-name" error={errors.name?.message}>
            <Input id="group-name" autoFocus {...form.register("name")} placeholder="e.g. Area A" />
          </FormField>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? <Spinner /> : "Create group"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
