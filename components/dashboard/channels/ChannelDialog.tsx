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
import { createChannel } from "@/app/action/channel.action";
import { ChannelSchema, type ChannelInput } from "@/servers/validators/monitoring.validator";

type Props = {
  trigger: ReactNode;
  credentials: { id: number; label: string; type: string }[];
};

export default function ChannelDialog({ trigger, credentials }: Props) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const form = useForm<ChannelInput>({
    resolver: zodResolver(ChannelSchema),
    defaultValues: { label: "", type: "telegram", chatId: "", url: "", credentialId: undefined, enabled: true },
  });
  const type = useWatch({ control: form.control, name: "type" });
  const errors = form.formState.errors;

  // a Telegram channel needs a bot token; a webhook may sign its requests with a secret
  const usable = credentials.filter((c) => c.type === (type === "telegram" ? "telegram_bot" : "webhook_secret"));

  function onSubmit(values: ChannelInput) {
    startTransition(async () => {
      const r = await createChannel({
        ...values,
        chatId: values.type === "telegram" ? values.chatId : undefined,
        url: values.type === "webhook" ? values.url : undefined,
      });
      if (!r.ok) return void toast.error(r.error);
      toast.success("Channel created");
      form.reset();
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New channel</DialogTitle>
          <DialogDescription>Where alerts are sent. Use “Send test” afterwards to check it really arrives.</DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="mt-2 space-y-4">
          <FormField label="Name" htmlFor="label" error={errors.label?.message}>
            <Input id="label" {...form.register("label")} placeholder="e.g. NOC Telegram group" />
          </FormField>

          <Controller
            name="type"
            control={form.control}
            render={({ field }) => (
              <FormField label="Type">
                <Select
                  value={field.value}
                  onValueChange={(v) => {
                    field.onChange(v);
                    form.setValue("credentialId", undefined);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="telegram">Telegram</SelectItem>
                    <SelectItem value="webhook">Webhook</SelectItem>
                  </SelectContent>
                </Select>
              </FormField>
            )}
          />

          {type === "telegram" ? (
            <FormField label="Chat ID" htmlFor="chatId" error={errors.chatId?.message}>
              <Input id="chatId" {...form.register("chatId")} placeholder="-1001234567890" />
            </FormField>
          ) : (
            <FormField label="Webhook URL" htmlFor="url" error={errors.url?.message}>
              <Input id="url" {...form.register("url")} placeholder="https://example.com/hooks/nms" />
            </FormField>
          )}

          <Controller
            name="credentialId"
            control={form.control}
            render={({ field }) => (
              <FormField
                label={type === "telegram" ? "Bot token" : "Signing secret"}
                optional={type === "webhook"}
                error={errors.credentialId?.message}
                hint={usable.length === 0 ? `Create a “${type === "telegram" ? "Telegram bot token" : "Webhook signing secret"}” credential first.` : undefined}
              >
                <Select value={field.value ? String(field.value) : ""} onValueChange={(v) => field.onChange(Number(v))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a credential" />
                  </SelectTrigger>
                  <SelectContent>
                    {usable.map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
            )}
          />

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
