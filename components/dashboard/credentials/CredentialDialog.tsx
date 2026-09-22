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
import { Spinner } from "@/components/ui/spinner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import FormField from "../FormField";
import { createCredential, rotateCredential } from "@/app/action/credential.action";
import {
  AUTH_PROTOCOLS,
  CredentialSchema,
  PRIV_PROTOCOLS,
  type CredentialInput,
} from "@/servers/validators/monitoring.validator";

export const CREDENTIAL_TYPE_LABELS: Record<string, string> = {
  snmp_v2c: "SNMP v2c (community)",
  snmp_v1: "SNMP v1 (community)",
  snmp_v3: "SNMP v3 (user)",
  telegram_bot: "Telegram bot token",
  webhook_secret: "Webhook signing secret",
};

type Props = {
  trigger: ReactNode;
  // limits the choices (the wizard only needs SNMP credentials)
  allowedTypes?: string[];
  // rotate mode: the label and type are fixed and only the secret is replaced
  existing?: { id: number; label: string; type: string };
  onCreated?: (id: number) => void;
};

export default function CredentialDialog({ trigger, allowedTypes, existing, onCreated }: Props) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const types = allowedTypes ?? Object.keys(CREDENTIAL_TYPE_LABELS);

  const form = useForm<CredentialInput>({
    resolver: zodResolver(CredentialSchema),
    defaultValues: {
      label: existing?.label ?? "",
      type: (existing?.type ?? types[0]) as CredentialInput["type"],
      community: "",
      username: "",
      authKey: "",
      privKey: "",
      botToken: "",
      secret: "",
    },
  });
  const type = useWatch({ control: form.control, name: "type" });
  const errors = form.formState.errors;

  function onSubmit(values: CredentialInput) {
    // empty optional fields must not be sent as empty strings
    const clean = Object.fromEntries(Object.entries(values).filter(([, v]) => v !== "" && v !== undefined)) as CredentialInput;
    startTransition(async () => {
      const result = existing ? await rotateCredential(existing.id, clean) : await createCredential(clean);
      if (!result.ok) return void toast.error(result.error);
      toast.success(existing ? "Secret replaced" : "Credential saved");
      form.reset();
      setOpen(false);
      if (!existing && typeof result.data === "number") onCreated?.(result.data);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{existing ? `Replace secret: ${existing.label}` : "New credential"}</DialogTitle>
          <DialogDescription>
            Secrets are stored encrypted and can never be shown again, only replaced.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="mt-2 space-y-4">
          {!existing && (
            <>
              <FormField label="Name" htmlFor="label" error={errors.label?.message}>
                <Input id="label" {...form.register("label")} placeholder="e.g. Core routers" />
              </FormField>

              <Controller
                name="type"
                control={form.control}
                render={({ field }) => (
                  <FormField label="Type">
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {types.map((t) => (
                          <SelectItem key={t} value={t}>
                            {CREDENTIAL_TYPE_LABELS[t]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormField>
                )}
              />
            </>
          )}

          {(type === "snmp_v1" || type === "snmp_v2c") && (
            <FormField label="Community string" htmlFor="community" error={errors.community?.message}>
              <Input id="community" type="password" autoComplete="off" {...form.register("community")} />
            </FormField>
          )}

          {type === "snmp_v3" && (
            <>
              <FormField label="Username" htmlFor="username" error={errors.username?.message}>
                <Input id="username" autoComplete="off" {...form.register("username")} />
              </FormField>
              <div className="grid grid-cols-2 gap-3">
                <Controller
                  name="authProtocol"
                  control={form.control}
                  render={({ field }) => (
                    <FormField label="Auth protocol" optional>
                      <Select value={field.value ?? "none"} onValueChange={(v) => field.onChange(v === "none" ? undefined : v)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {AUTH_PROTOCOLS.map((p) => (
                            <SelectItem key={p} value={p}>{p}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormField>
                  )}
                />
                <FormField label="Auth key" htmlFor="authKey" optional error={errors.authKey?.message}>
                  <Input id="authKey" type="password" autoComplete="off" {...form.register("authKey")} />
                </FormField>
                <Controller
                  name="privProtocol"
                  control={form.control}
                  render={({ field }) => (
                    <FormField label="Privacy protocol" optional>
                      <Select value={field.value ?? "none"} onValueChange={(v) => field.onChange(v === "none" ? undefined : v)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {PRIV_PROTOCOLS.map((p) => (
                            <SelectItem key={p} value={p}>{p}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </FormField>
                  )}
                />
                <FormField label="Privacy key" htmlFor="privKey" optional error={errors.privKey?.message}>
                  <Input id="privKey" type="password" autoComplete="off" {...form.register("privKey")} />
                </FormField>
              </div>
            </>
          )}

          {type === "telegram_bot" && (
            <FormField label="Bot token" htmlFor="botToken" error={errors.botToken?.message}>
              <Input id="botToken" type="password" autoComplete="off" {...form.register("botToken")} />
            </FormField>
          )}

          {type === "webhook_secret" && (
            <FormField label="Signing secret" htmlFor="secret" error={errors.secret?.message} hint="At least 8 characters. Used to sign the requests we send to your webhook.">
              <Input id="secret" type="password" autoComplete="off" {...form.register("secret")} />
            </FormField>
          )}

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? <Spinner /> : existing ? "Replace secret" : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
