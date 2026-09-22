"use client";

import { useTransition } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import FormField from "../FormField";
import { createAlertRules, updateAlertRule } from "@/app/action/alert.action";
import {
  OPERATORS,
  RuleSchema,
  SEVERITIES,
  THRESHOLD_METRICS,
  type RuleInput,
} from "@/servers/validators/monitoring.validator";

const CONDITIONS = [
  { value: "device_down", label: "Device is down", hint: "Fires when the device stops answering (after the failed polls set on the device)." },
  { value: "snmp_unavailable", label: "SNMP is not responding", hint: "The device answers ping but SNMP does not." },
  { value: "interface_down", label: "An interface goes down", hint: "Only for interfaces that were up before, so unused ports never alert." },
  { value: "metric_threshold", label: "A value crosses a threshold", hint: "CPU, memory, latency, packet loss or interface traffic." },
] as const;

type Props = {
  devices: { id: number; name: string }[];
  channels: { id: number; label: string }[];
  // present when editing
  existing?: { id: number; values: RuleInput };
};

export default function AlertRuleForm({ devices, channels, existing }: Props) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const form = useForm<RuleInput>({
    resolver: zodResolver(RuleSchema),
    defaultValues: existing?.values ?? {
      name: "",
      deviceId: devices.length === 1 ? devices[0].id : "all",
      conditionType: "device_down",
      severity: "critical",
      cooldownSec: 0,
      notifyOnRecovery: true,
      enabled: true,
      channelIds: channels.map((c) => c.id),
    },
  });
  const values = useWatch({ control: form.control });
  const errors = form.formState.errors;

  function onSubmit(input: RuleInput) {
    startTransition(async () => {
      const r = existing ? await updateAlertRule(existing.id, input) : await createAlertRules(input);
      if (!r.ok) return void toast.error(r.error);
      toast.success(existing ? "Rule saved" : typeof r.data === "number" && r.data > 1 ? `${r.data} rules created` : "Rule created");
      router.push("/dashboard/alerts");
    });
  }

  const condition = CONDITIONS.find((c) => c.value === values.conditionType);

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="max-w-2xl space-y-6">
      <FormField label="Name" htmlFor="name" error={errors.name?.message}>
        <Input id="name" {...form.register("name")} placeholder="e.g. Router down" />
      </FormField>

      {!existing && (
        <Controller
          name="deviceId"
          control={form.control}
          render={({ field }) => (
            <FormField label="Applies to" error={errors.deviceId?.message} hint="“All my devices” creates one rule per device you have right now.">
              <Select value={String(field.value)} onValueChange={(v) => field.onChange(v === "all" ? "all" : Number(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All my devices ({devices.length})</SelectItem>
                  {devices.map((d) => (
                    <SelectItem key={d.id} value={String(d.id)}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
          )}
        />
      )}

      <Controller
        name="conditionType"
        control={form.control}
        render={({ field }) => (
          <FormField label="When" hint={condition?.hint}>
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CONDITIONS.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
        )}
      />

      {values.conditionType === "metric_threshold" && (
        <div className="grid gap-4 rounded-lg border p-4 sm:grid-cols-3">
          <Controller
            name="metric"
            control={form.control}
            render={({ field }) => (
              <FormField label="Value" error={errors.metric?.message}>
                <Select value={field.value ?? ""} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose" />
                  </SelectTrigger>
                  <SelectContent>
                    {THRESHOLD_METRICS.map((m) => (
                      <SelectItem key={m.value} value={m.value}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
            )}
          />
          <Controller
            name="operator"
            control={form.control}
            render={({ field }) => (
              <FormField label="Is" error={errors.operator?.message}>
                <Select value={field.value ?? ""} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose" />
                  </SelectTrigger>
                  <SelectContent>
                    {OPERATORS.map((o) => (
                      <SelectItem key={o} value={o}>
                        {o}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
            )}
          />
          <FormField label="Threshold" htmlFor="threshold" error={errors.threshold?.message}>
            <Input id="threshold" type="number" step="any" {...form.register("threshold", { setValueAs: (v) => (v === "" || v === undefined ? undefined : Number(v)) })} />
          </FormField>
        </div>
      )}

      <Controller
        name="severity"
        control={form.control}
        render={({ field }) => (
          <FormField label="Severity">
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SEVERITIES.map((s) => (
                  <SelectItem key={s} value={s} className="capitalize">
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
        )}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <FormField label="Open after (checks)" htmlFor="triggerAfter" optional hint="Consecutive bad checks. Empty = sensible default." error={errors.triggerAfter?.message}>
          <Input id="triggerAfter" type="number" {...form.register("triggerAfter", { setValueAs: (v) => (v === "" || v === undefined ? undefined : Number(v)) })} />
        </FormField>
        <FormField label="Close after (checks)" htmlFor="clearAfter" optional error={errors.clearAfter?.message}>
          <Input id="clearAfter" type="number" {...form.register("clearAfter", { setValueAs: (v) => (v === "" || v === undefined ? undefined : Number(v)) })} />
        </FormField>
        <FormField label="Quiet time after close (s)" htmlFor="cooldown" error={errors.cooldownSec?.message}>
          <Input id="cooldown" type="number" {...form.register("cooldownSec", { valueAsNumber: true })} />
        </FormField>
      </div>

      <Controller
        name="channelIds"
        control={form.control}
        render={({ field }) => (
          <FormField label="Notify" hint={channels.length === 0 ? "No channels yet. Create one to get messages." : undefined}>
            <div className="space-y-2 rounded-lg border p-3">
              {channels.map((c) => (
                <div key={c.id} className="flex items-center gap-2">
                  <Checkbox
                    id={`ch-${c.id}`}
                    checked={field.value?.includes(c.id) ?? false}
                    onCheckedChange={(v) =>
                      field.onChange(v === true ? [...(field.value ?? []), c.id] : (field.value ?? []).filter((x) => x !== c.id))
                    }
                  />
                  <Label htmlFor={`ch-${c.id}`}>{c.label}</Label>
                </div>
              ))}
              {channels.length === 0 && <p className="text-muted-foreground text-sm">No channels.</p>}
            </div>
          </FormField>
        )}
      />

      <div className="flex flex-wrap gap-6">
        <Controller
          name="notifyOnRecovery"
          control={form.control}
          render={({ field }) => (
            <div className="flex items-center gap-3">
              <Switch id="recovery" checked={field.value} onCheckedChange={field.onChange} />
              <Label htmlFor="recovery">Also tell me when it recovers</Label>
            </div>
          )}
        />
        <Controller
          name="enabled"
          control={form.control}
          render={({ field }) => (
            <div className="flex items-center gap-3">
              <Switch id="enabled" checked={field.value} onCheckedChange={field.onChange} />
              <Label htmlFor="enabled">Enabled</Label>
            </div>
          )}
        />
      </div>

      <div className="flex gap-3">
        <Button type="submit" disabled={isPending}>
          {isPending ? <Spinner /> : existing ? "Save rule" : "Create rule"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push("/dashboard/alerts")}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
