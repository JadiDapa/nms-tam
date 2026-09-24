"use client";

import { useState, useTransition } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, Check, ChevronLeft, ChevronRight, Plus } from "lucide-react";

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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import FormField from "../FormField";
import CredentialDialog from "../credentials/CredentialDialog";
import TestResultView from "./TestResultView";
import LocationPicker from "../map/LocationPicker";
import { createDevice, testDevice } from "@/app/action/device.action";
import {
  CreateDeviceSchema,
  DEVICE_TYPES,
  type CreateDeviceInput,
} from "@/servers/validators/monitoring.validator";
import type { EngineTestResult } from "@/servers/engine/engine-types";

type Props = {
  credentials: { id: number; label: string; type: string }[];
  minPollIntervalSec: number;
  used: number;
  limit: number;
};

const STEPS = ["Device", "Checks & test", "Polling"] as const;

// Which fields each step must have valid before moving on.
const STEP_FIELDS: Record<number, (keyof CreateDeviceInput)[]> = {
  0: ["name", "host", "deviceType", "location", "latitude", "longitude"],
  1: ["icmpEnabled", "tcpPorts", "snmpEnabled", "snmpCredentialId", "snmpPort"],
  2: ["polling"],
};

export default function DeviceWizard({ credentials, minPollIntervalSec, used, limit }: Props) {
  const [step, setStep] = useState(0);
  const [tcpText, setTcpText] = useState("");
  const [testing, startTesting] = useTransition();
  const [saving, startSaving] = useTransition();
  const [result, setResult] = useState<EngineTestResult | null>(null);
  const [testedFor, setTestedFor] = useState<string | null>(null);
  const [saveAnyway, setSaveAnyway] = useState(false);
  const router = useRouter();

  const form = useForm<CreateDeviceInput>({
    resolver: zodResolver(CreateDeviceSchema),
    defaultValues: {
      name: "",
      host: "",
      deviceType: "router",
      location: "",
      icmpEnabled: true,
      tcpPorts: [],
      snmpEnabled: true,
      snmpCredentialId: undefined,
      snmpPort: 161,
      enabled: true,
      polling: { pollIntervalSec: Math.max(30, minPollIntervalSec), timeoutMs: 3000, retryCount: 1 },
    },
  });
  const values = useWatch({ control: form.control });
  const errors = form.formState.errors;

  // the test result is only valid for the exact settings it was run with
  const fingerprint = JSON.stringify([values.host, values.icmpEnabled, values.tcpPorts, values.snmpEnabled, values.snmpCredentialId, values.snmpPort]);
  const testIsCurrent = result !== null && testedFor === fingerprint;

  async function next() {
    const ok = await form.trigger(STEP_FIELDS[step]);
    if (ok) setStep(step + 1);
  }

  function runTest() {
    const v = form.getValues();
    startTesting(async () => {
      const r = await testDevice({
        host: v.host,
        icmp: v.icmpEnabled,
        tcpPorts: v.tcpPorts ?? [],
        snmpCredentialId: v.snmpEnabled ? v.snmpCredentialId : undefined,
        snmpPort: v.snmpPort,
      });
      if (!r.ok) return void toast.error(r.error);
      setResult(r.data);
      setTestedFor(fingerprint);
      setSaveAnyway(false);
    });
  }

  function save(input: CreateDeviceInput) {
    startSaving(async () => {
      const r = await createDevice(input);
      if (!r.ok) return void toast.error(r.error);
      toast.success("Device added");
      router.push(`/dashboard/devices/${r.data}`);
    });
  }

  const untested = !testIsCurrent;
  const failed = testIsCurrent && !result!.reachable;
  const needsConfirm = untested || failed;

  return (
    <form onSubmit={form.handleSubmit(save)} className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_320px]">
      <div className="space-y-6">
      {/* progress */}
      <ol className="flex items-start justify-center">
        {STEPS.map((label, i) => (
          <li key={label} className="contents">
            <div className="flex flex-col items-center gap-1.5">
              <span
                className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
                  i < step
                    ? "bg-primary text-primary-foreground"
                    : i === step
                      ? "bg-primary text-primary-foreground ring-4 ring-primary/15"
                      : "bg-muted text-muted-foreground"
                }`}
              >
                {i < step ? <Check className="size-3.5" /> : i + 1}
              </span>
              <span className={`text-xs whitespace-nowrap ${i === step ? "font-medium text-foreground" : "text-muted-foreground"}`}>
                {label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div className={`mt-3.5 h-0.5 w-10 shrink-0 self-start rounded-full mx-2 sm:w-16 ${i < step ? "bg-primary" : "bg-muted"}`} />
            )}
          </li>
        ))}
      </ol>

      {step === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Device details</CardTitle>
            <CardDescription>What it is and where our monitoring servers will reach it.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Name" htmlFor="name" error={errors.name?.message}>
                <Input id="name" {...form.register("name")} placeholder="e.g. Branch router" />
              </FormField>
              <Controller
                name="deviceType"
                control={form.control}
                render={({ field }) => (
                  <FormField label="Type">
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="w-full">
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
            </div>
            <FormField label="IP address or host name" htmlFor="host" error={errors.host?.message} hint="Must be reachable from the internet.">
              <Input id="host" {...form.register("host")} placeholder="203.0.113.10" />
            </FormField>
            <FormField label="Location" htmlFor="location" optional error={errors.location?.message}>
              <Input id="location" {...form.register("location")} placeholder="e.g. Palembang POP" />
            </FormField>
            <div className="space-y-2">
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
          </CardContent>
        </Card>
      )}

      {step === 1 && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Checks to run</CardTitle>
              <CardDescription>How we&apos;ll monitor this device once it&apos;s saved.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <Controller
                name="icmpEnabled"
                control={form.control}
                render={({ field }) => (
                  <div className="flex items-center gap-3">
                    <Switch id="icmp" checked={field.value} onCheckedChange={field.onChange} />
                    <Label htmlFor="icmp">Ping (ICMP): is it up, and how fast</Label>
                  </div>
                )}
              />
              {errors.icmpEnabled?.message && <p className="text-destructive text-sm">{errors.icmpEnabled.message}</p>}

              <FormField label="TCP ports to check" htmlFor="tcp" optional error={errors.tcpPorts?.message as string | undefined} hint="Comma separated, e.g. 22, 443, 8291">
                <Input
                  id="tcp"
                  value={tcpText}
                  onChange={(e) => {
                    setTcpText(e.target.value);
                    const ports = e.target.value
                      .split(",")
                      .map((p) => p.trim())
                      .filter(Boolean)
                      .map(Number);
                    form.setValue("tcpPorts", ports.filter((p) => Number.isInteger(p)), { shouldValidate: true });
                  }}
                  placeholder="22, 443"
                />
              </FormField>

              <Controller
                name="snmpEnabled"
                control={form.control}
                render={({ field }) => (
                  <div className="flex items-center gap-3">
                    <Switch id="snmp" checked={field.value} onCheckedChange={field.onChange} />
                    <Label htmlFor="snmp">SNMP: CPU, memory and interface traffic</Label>
                  </div>
                )}
              />

              {values.snmpEnabled && (
                <div className="space-y-4 rounded-lg border p-4">
                  <Controller
                    name="snmpCredentialId"
                    control={form.control}
                    render={({ field }) => (
                      <FormField label="SNMP credential" error={errors.snmpCredentialId?.message}>
                        <div className="flex gap-2">
                          <Select
                            value={field.value ? String(field.value) : ""}
                            onValueChange={(v) => field.onChange(Number(v))}
                          >
                            <SelectTrigger className="flex-1">
                              <SelectValue placeholder={credentials.length ? "Choose a credential" : "Create one first"} />
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
                              <Button type="button" variant="outline">
                                <Plus className="size-4" />
                                New
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
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Test it live</CardTitle>
              <CardDescription>We run the real checks now and show what came back. Nothing is saved yet.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button type="button" onClick={runTest} disabled={testing}>
                {testing ? <Spinner /> : testIsCurrent ? "Test again" : "Run test"}
              </Button>

              {testIsCurrent && <TestResultView result={result!} />}
              {result && !testIsCurrent && (
                <p className="text-muted-foreground text-sm">The settings changed since the last test. Run it again.</p>
              )}

              {failed && (
                <div className="flex gap-2 rounded-lg bg-yellow-500/10 p-3 text-sm text-yellow-700 dark:text-yellow-500">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                  <p>
                    The device did not answer. You can still save it (for example if it is offline right now), but it
                    will show as DOWN until it responds, and it uses one of your slots.
                  </p>
                </div>
              )}

              {needsConfirm && (
                <div className="flex items-center gap-2">
                  <Checkbox id="anyway" checked={saveAnyway} onCheckedChange={(v) => setSaveAnyway(v === true)} />
                  <Label htmlFor="anyway" className="text-sm">
                    {untested ? "Continue without a successful test" : "Save it anyway"}
                  </Label>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Polling settings</CardTitle>
              <CardDescription>How often and how patiently we check.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-3">
                <FormField
                  label="Check every (seconds)"
                  htmlFor="interval"
                  error={errors.polling?.pollIntervalSec?.message}
                  hint={`Plan allows ${minPollIntervalSec}s or slower.`}
                >
                  <Input id="interval" type="number" {...form.register("polling.pollIntervalSec", { valueAsNumber: true })} />
                </FormField>
                <FormField label="Timeout (ms)" htmlFor="timeout" error={errors.polling?.timeoutMs?.message}>
                  <Input id="timeout" type="number" {...form.register("polling.timeoutMs", { valueAsNumber: true })} />
                </FormField>
                <FormField label="Retries" htmlFor="retries" error={errors.polling?.retryCount?.message}>
                  <Input id="retries" type="number" {...form.register("polling.retryCount", { valueAsNumber: true })} />
                </FormField>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Review</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="text-muted-foreground space-y-1.5 text-sm">
                <li className="text-foreground font-medium">
                  {values.name} · {values.host}
                </li>
                <li>
                  Checks:{" "}
                  {[
                    values.icmpEnabled && "ping",
                    (values.tcpPorts?.length ?? 0) > 0 && `TCP ${values.tcpPorts?.join(", ")}`,
                    values.snmpEnabled && "SNMP",
                  ]
                    .filter(Boolean)
                    .join(", ")}
                </li>
                <li className={used + 1 > limit ? "text-destructive" : ""}>
                  This device uses slot {used + 1} of {limit}.
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="flex items-center justify-between">
        <Button type="button" variant="outline" onClick={() => (step === 0 ? router.push("/dashboard/devices") : setStep(step - 1))}>
          <ChevronLeft className="size-4" />
          {step === 0 ? "Cancel" : "Back"}
        </Button>

        {step < STEPS.length - 1 ? (
          <Button type="button" onClick={next} disabled={step === 1 && needsConfirm && !saveAnyway}>
            Next
            <ChevronRight className="size-4" />
          </Button>
        ) : (
          <Button type="submit" disabled={saving}>
            {saving ? <Spinner /> : "Add device"}
          </Button>
        )}
      </div>
      </div>

      <Card className="h-fit lg:sticky lg:top-6">
        <CardHeader>
          <CardTitle className="text-base">Summary</CardTitle>
          <CardDescription>Updates as you go.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div>
            <p className="font-medium">{values.name || "Untitled device"}</p>
            <p className="text-muted-foreground">{values.host || "No host yet"}</p>
          </div>

          <div className="flex flex-wrap gap-1.5">
            <Badge variant="outline" className="capitalize">
              {(values.deviceType ?? "router").replace("_", " ")}
            </Badge>
            {values.location && <Badge variant="outline">{values.location}</Badge>}
          </div>

          <div className="space-y-1.5 border-t pt-4">
            <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Checks</p>
            <div className="flex flex-wrap gap-1.5">
              {values.icmpEnabled && <Badge variant="secondary">Ping</Badge>}
              {(values.tcpPorts?.length ?? 0) > 0 && <Badge variant="secondary">TCP {values.tcpPorts?.join(", ")}</Badge>}
              {values.snmpEnabled && <Badge variant="secondary">SNMP</Badge>}
              {!values.icmpEnabled && !values.snmpEnabled && !values.tcpPorts?.length && (
                <span className="text-muted-foreground text-xs">None selected yet</span>
              )}
            </div>
            {step >= 1 &&
              (testIsCurrent ? (
                <Badge variant={result!.reachable ? "default" : "destructive"} className="mt-1">
                  {result!.reachable ? "Test passed" : "Test failed"}
                </Badge>
              ) : (
                <p className="text-muted-foreground text-xs">Not tested yet</p>
              ))}
          </div>

          <div className="space-y-1.5 border-t pt-4">
            <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Polling</p>
            <p className="text-muted-foreground">
              Every {values.polling?.pollIntervalSec ?? "—"}s · {values.polling?.timeoutMs ?? "—"}ms timeout ·{" "}
              {values.polling?.retryCount ?? "—"} {values.polling?.retryCount === 1 ? "retry" : "retries"}
            </p>
          </div>

          <div className="space-y-1.5 border-t pt-4">
            <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Device slots</p>
            <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
              <div
                className={`h-full rounded-full ${used + 1 > limit ? "bg-destructive" : "bg-primary"}`}
                style={{ width: `${Math.min(100, ((used + 1) / limit) * 100)}%` }}
              />
            </div>
            <p className={`text-xs ${used + 1 > limit ? "text-destructive" : "text-muted-foreground"}`}>
              {used + 1} of {limit} used
            </p>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}
