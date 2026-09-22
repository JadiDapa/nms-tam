"use client";

import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus } from "lucide-react";
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
import { Spinner } from "@/components/ui/spinner";
import FormField from "../FormField";
import { createOrganization } from "@/app/action/organization.action";
import { CreateOrganizationSchema } from "@/servers/validators/organization.validator";

type FormType = z.input<typeof CreateOrganizationSchema>;

export default function CreateOrganizationDialog() {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const form = useForm<FormType>({
    resolver: zodResolver(CreateOrganizationSchema),
    defaultValues: { name: "", note: "" },
  });
  const errors = form.formState.errors;

  function onSubmit(values: FormType) {
    startTransition(async () => {
      const r = await createOrganization(values);
      if (!r.ok) return void toast.error(r.error);
      toast.success("Client created. Now record its first payment to activate a plan.");
      form.reset();
      setOpen(false);
      router.push(`/dashboard/admin/organizations/${r.data}`);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" />
          New Client
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New client</DialogTitle>
          <DialogDescription>A company that will use the platform. A plan is activated by recording its first payment.</DialogDescription>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="mt-2 space-y-4">
          <FormField label="Company name" htmlFor="name" error={errors.name?.message}>
            <Input id="name" {...form.register("name")} />
          </FormField>
          <FormField label="Internal note" htmlFor="note" optional>
            <Input id="note" {...form.register("note")} />
          </FormField>
          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? <Spinner /> : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
