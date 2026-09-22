"use client";

import { useState, useTransition } from "react";
import { z } from "zod";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Spinner } from "@/components/ui/spinner";
import { CreateUserSchema } from "@/servers/validators/user.validator";
import { inviteUser } from "@/app/action/user.action";

type UserFormType = z.input<typeof CreateUserSchema>;

type Props = {
  organizations: { id: number; name: string }[];
  // when inviting from a client's page the client is fixed
  fixedOrgId?: number;
};

export default function CreateUserDialog({ organizations, fixedOrgId }: Props) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const form = useForm<UserFormType>({
    resolver: zodResolver(CreateUserSchema),
    defaultValues: {
      name: "",
      email: "",
      role: fixedOrgId ? "USER" : "USER",
      orgId: fixedOrgId ?? null,
    },
  });
  const role = useWatch({ control: form.control, name: "role" });

  function onSubmit(values: UserFormType) {
    startTransition(async () => {
      const r = await inviteUser(values);
      if (!r.ok) return void toast.error(r.error);
      toast.success("Invitation sent");
      form.reset();
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" />
          Invite User
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Invite user</DialogTitle>
          <p className="text-muted-foreground text-sm">
            They receive an email with a link to choose a password. There is no other way to sign up.
          </p>
        </DialogHeader>
        <form onSubmit={form.handleSubmit(onSubmit)} className="mt-2 space-y-4">
          <Controller
            name="name"
            control={form.control}
            render={({ field, fieldState }) => (
              <div className="space-y-1.5">
                <Label htmlFor="name">Name</Label>
                <Input id="name" {...field} placeholder="Full name" />
                {fieldState.error && <p className="text-destructive text-sm">{fieldState.error.message}</p>}
              </div>
            )}
          />

          <Controller
            name="email"
            control={form.control}
            render={({ field, fieldState }) => (
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" {...field} placeholder="name@company.com" />
                {fieldState.error && <p className="text-destructive text-sm">{fieldState.error.message}</p>}
              </div>
            )}
          />

          {!fixedOrgId && (
            <Controller
              name="role"
              control={form.control}
              render={({ field }) => (
                <div className="space-y-1.5">
                  <Label>Role</Label>
                  <Select
                    value={field.value}
                    onValueChange={(v) => {
                      field.onChange(v);
                      if (v === "ADMIN") form.setValue("orgId", null);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USER">Client user</SelectItem>
                      <SelectItem value="ADMIN">Admin (our staff)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            />
          )}

          {role === "USER" && !fixedOrgId && (
            <Controller
              name="orgId"
              control={form.control}
              render={({ field, fieldState }) => (
                <div className="space-y-1.5">
                  <Label>Client</Label>
                  <Select value={field.value ? String(field.value) : ""} onValueChange={(v) => field.onChange(Number(v))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a client" />
                    </SelectTrigger>
                    <SelectContent>
                      {organizations.map((o) => (
                        <SelectItem key={o.id} value={String(o.id)}>
                          {o.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {fieldState.error && <p className="text-destructive text-sm">{fieldState.error.message}</p>}
                </div>
              )}
            />
          )}

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? <Spinner /> : "Send invitation"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
