"use client";

import { useState, useTransition } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
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
import LocationPicker from "../map/LocationPicker";
import CredentialDialog from "../credentials/CredentialDialog";
import { updateDevice } from "@/app/action/device.action";
import {
  DEVICE_TYPES,
  UpdateDeviceSchema,
  type UpdateDeviceInput,
} from "@/servers/validators/monitoring.validator";
import type { EngineDevice } from "@/servers/engine/engine-types";

type Props = {
  deviceId: number;
  device: EngineDevice;
  // the credential currently used (our id), if any
  currentCredentialId: number | null;
  // where the device is on the map (kept by this app, not the engine)
  latitude: number | null;
  longitude: number | null;
  credentials: { id: number; label: string }[];
  minPollIntervalSec: number;
  canChange: boolean;
};

export default function DeviceSettingsForm({ deviceId, device, currentCredentialId, latitude, longitude, credentials, minPollIntervalSec, canChange }: Props) {
  const [isPending, startTransition] = useTransition();
  const [tcpText, setTcpText] = useState(device.tcpPorts.join(", "));
  const router = useRouter();

  const form = useForm<UpdateDeviceInput>({
    resolver: zodResolver(UpdateDeviceSchema),
    defaultValues: {
      name: device.name,
      host: device.host,
      deviceType: device.deviceType as UpdateDeviceInput["deviceType"],
      location: device.location ?? "",
      latitude,
      longitude,
      icmpEnabled: device.icmpEnabled,
      tcpPorts: device.tcpPorts,
      snmpEnabled: device.snmpEnabled,
      snmpCredentialId: currentCredentialId ?? undefined,
      snmpPort: device.snmpPort,
      polling: {
        pollIntervalSec: device.polling.pollIntervalSec,
        timeoutMs: device.polling.timeoutMs,
        retryCount: device.polling.retryCount,
        failureThreshold: device.polling.failureThreshold,
        recoveryThreshold: device.polling.recoveryThreshold,
        snmpFailureThreshold: device.polling.snmpFailureThreshold,
        snmpRecoveryThreshold: device.polling.snmpRecoveryThreshold,
      },
    },
  });
  const values = useWatch({ control: form.control });
  const errors = form.formState.errors;

  function onSubmit(input: UpdateDeviceInput) {
    startTransition(async () => {
      const r = await updateDevice(deviceId, { ...input, location: input.location || null });
      if (!r.ok) return void toast.error(r.error);
      toast.success("Settings saved");
      router.refresh();
    });
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      <fieldset disabled={!canChange} className="grid items-start gap-6 xl:grid-cols-2">
        <div className="bg-card grid gap-4 rounded-3xl p-6 shadow-xs sm:grid-cols-2">
          <p className="text-lg font-medium sm:col-span-2">Identity</p>
          <FormField label="Name" htmlFor="name" error={errors.name?.message}>
            <Input id="name" {...form.register("name")} />
          </FormField>
          <FormField label="IP address or host name" htmlFor="host" error={errors.host?.message}>
            <Input id="host" {...form.register("host")} />
          </FormField>
          <Controller
            name="deviceType"
            control={form.control}
            render={({ field }) => (
              <FormField label="Type">
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DEVICE_TYPES.map((t) => (
                      <SelectItem key={t} value={t} className="capitalize">
                        {t.replace("_", " ")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormField>
            )}
          />
          <FormField label="Location" htmlFor="location" optional>
            <Input id="location" {...form.register("location")} />
          </FormField>
          <div className="space-y-2 sm:col-span-2">
            <p className="text-sm font-medium">Position on the map</p>
            <LocationPicker
              latitude={values.latitude}
              longitude={values.longitude}
              error={errors.latitude?.message ?? errors.longitude?.message}
              onChange={(lat, lng) => {
                form.setValue("latitude", lat, { shouldDirty: true, shouldValidate: true });
                form.setValue("longitude", lng, { shouldDirty: true, shouldValidate: true });
              }}
            />
          </div>
        </div>

        <div className="space-y-6">
        <div className="bg-card space-y-4 rounded-3xl p-6 shadow-xs">
          <p className="text-lg font-medium">Checks</p>
          <Controller
            name="icmpEnabled"
            control={form.control}
            render={({ field }) => (
              <div className="flex items-center gap-3">
                <Switch id="icmp" checked={field.value} onCheckedChange={field.onChange} />
                <Label htmlFor="icmp">Ping (ICMP)</Label>
              </div>
            )}
          />
          <FormField label="TCP ports" htmlFor="tcp" optional error={errors.tcpPorts?.message as string | undefined}>
            <Input
              id="tcp"
              value={tcpText}
              onChange={(e) => {
                setTcpText(e.target.value);
                const ports = e.target.value.split(",").map((p) => p.trim()).filter(Boolean).map(Number);
                form.setValue("tcpPorts", ports.filter((p) => Number.isInteger(p)), { shouldValidate: true });
              }}
            />
          </FormField>
          <Controller
            name="snmpEnabled"
            control={form.control}
            render={({ field }) => (
              <div className="flex items-center gap-3">
                <Switch id="snmp" checked={field.value} onCheckedChange={field.onChange} />
                <Label htmlFor="snmp">SNMP</Label>
              </div>
            )}
          />
          {values.snmpEnabled && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Controller
                name="snmpCredentialId"
                control={form.control}
                render={({ field }) => (
                  <FormField label="SNMP credential" error={errors.snmpCredentialId?.message}>
                    <div className="flex gap-2">
                      <Select value={field.value ? String(field.value) : ""} onValueChange={(v) => field.onChange(Number(v))}>
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Choose a credential" />
                        </SelectTrigger>
                        <SelectContent>
                          {credentials.map((c) => (
                            <SelectItem key={c.id} value={String(c.id)}>
                              {c.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <CredentialDialog
                        allowedTypes={["snmp_v2c", "snmp_v1", "snmp_v3"]}
                        onCreated={(id) => field.onChange(id)}
                        trigger={
                          <Button type="button" variant="outline" size="icon">
                            <Plus className="size-4" />
                          </Button>
                        }
                      />
                    </div>
                  </FormField>
                )}
              />
              <FormField label="SNMP port" htmlFor="snmpPort" error={errors.snmpPort?.message}>
                <Input id="snmpPort" type="number" {...form.register("snmpPort", { valueAsNumber: true })} />
              </FormField>
            </div>
          )}
        </div>

        <div className="bg-card space-y-4 rounded-3xl p-6 shadow-xs">
          <p className="text-lg font-medium">Polling</p>
          <div className="grid gap-4 sm:grid-cols-3">
            <FormField label="Check every (s)" htmlFor="interval" error={errors.polling?.pollIntervalSec?.message} hint={`Plan minimum: ${minPollIntervalSec} s`}>
              <Input id="interval" type="number" {...form.register("polling.pollIntervalSec", { valueAsNumber: true })} />
            </FormField>
            <FormField label="Timeout (ms)" htmlFor="timeout" error={errors.polling?.timeoutMs?.message}>
              <Input id="timeout" type="number" {...form.register("polling.timeoutMs", { valueAsNumber: true })} />
            </FormField>
            <FormField label="Retries" htmlFor="retries" error={errors.polling?.retryCount?.message}>
              <Input id="retries" type="number" {...form.register("polling.retryCount", { valueAsNumber: true })} />
            </FormField>
            <FormField label="Down after (failed polls)" htmlFor="ft" error={errors.polling?.failureThreshold?.message} hint="Consecutive failures before DOWN">
              <Input id="ft" type="number" {...form.register("polling.failureThreshold", { valueAsNumber: true })} />
            </FormField>
            <FormField label="Up after (good polls)" htmlFor="rt" error={errors.polling?.recoveryThreshold?.message}>
              <Input id="rt" type="number" {...form.register("polling.recoveryThreshold", { valueAsNumber: true })} />
            </FormField>
            <FormField label="SNMP down after" htmlFor="sft" error={errors.polling?.snmpFailureThreshold?.message}>
              <Input id="sft" type="number" {...form.register("polling.snmpFailureThreshold", { valueAsNumber: true })} />
            </FormField>
            <FormField label="SNMP up after" htmlFor="srt" error={errors.polling?.snmpRecoveryThreshold?.message}>
              <Input id="srt" type="number" {...form.register("polling.snmpRecoveryThreshold", { valueAsNumber: true })} />
            </FormField>
          </div>
        </div>
        </div>
      </fieldset>

      {canChange && (
        <Button type="submit" disabled={isPending} className="rounded-xl">
          {isPending ? <Spinner /> : "Save settings"}
        </Button>
      )}
    </form>
  );
}
