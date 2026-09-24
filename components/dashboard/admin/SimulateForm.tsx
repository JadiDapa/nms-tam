"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import FormField from "../FormField";
import { simulateHistoricalData } from "@/app/action/simulate.action";
import type { SimulateResult } from "@/servers/engine/engine-types";

type DeviceOption = { id: number; name: string; orgName: string; pollIntervalSec: number };
type DurationUnit = "seconds" | "minutes" | "hours";

const UNIT_TO_SEC: Record<DurationUnit, number> = { seconds: 1, minutes: 60, hours: 3600 };
const MAX_SAMPLES = 100_000;

export default function SimulateForm({ devices }: { devices: DeviceOption[] }) {
  const [scope, setScope] = useState<"all" | "selected">("all");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [search, setSearch] = useState("");
  const [startAt, setStartAt] = useState("");
  const [durationValue, setDurationValue] = useState(6);
  const [durationUnit, setDurationUnit] = useState<DurationUnit>("hours");
  const [targetAlertCount, setTargetAlertCount] = useState(0);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [result, setResult] = useState<SimulateResult | null>(null);
  const [pending, startTransition] = useTransition();

  const filtered = useMemo(
    () => devices.filter((d) => d.name.toLowerCase().includes(search.toLowerCase()) || d.orgName.toLowerCase().includes(search.toLowerCase())),
    [devices, search],
  );

  const activeDevices = scope === "all" ? devices : devices.filter((d) => selectedIds.includes(d.id));
  const durationSec = durationValue * UNIT_TO_SEC[durationUnit];
  const estimatedSamples = activeDevices.reduce((sum, d) => sum + (Math.floor(durationSec / Math.max(1, d.pollIntervalSec)) + 1) * 4, 0);

  function toggle(id: number) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function openConfirm() {
    setFormError(null);
    if (!startAt) return setFormError("Pick a start date and time");
    if (scope === "selected" && selectedIds.length === 0) return setFormError("Pick at least one device");
    if (durationValue <= 0) return setFormError("Duration must be positive");
    if (estimatedSamples > MAX_SAMPLES) return setFormError(`This would generate ~${estimatedSamples.toLocaleString()} samples (limit ${MAX_SAMPLES.toLocaleString()}). Reduce devices or duration.`);
    setConfirmOpen(true);
  }

  function submit() {
    startTransition(async () => {
      const r = await simulateHistoricalData({
        scope,
        deviceIds: scope === "selected" ? selectedIds : [],
        startAt: new Date(startAt),
        durationValue,
        durationUnit,
        targetAlertCount,
      });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      toast.success("Simulation complete");
      setConfirmOpen(false);
      setResult(r.data);
    });
  }

  const endPreview = startAt ? new Date(new Date(startAt).getTime() + durationSec * 1000) : null;

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="space-y-5 p-5">
          <FormField label="Devices">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Checkbox id="scope-all" checked={scope === "all"} onCheckedChange={(c) => setScope(c ? "all" : "selected")} />
                <label htmlFor="scope-all" className="text-sm">
                  All devices ({devices.length})
                </label>
              </div>
              {scope === "selected" && (
                <div className="space-y-2 rounded-md border p-2">
                  <Input placeholder="Search devices or org…" value={search} onChange={(e) => setSearch(e.target.value)} />
                  <div className="max-h-56 space-y-1 overflow-y-auto">
                    {filtered.length === 0 && <p className="text-muted-foreground p-2 text-sm">No devices match.</p>}
                    {filtered.map((d) => (
                      <div key={d.id} className="flex items-center gap-2 rounded px-1 py-1 hover:bg-accent">
                        <Checkbox id={`device-${d.id}`} checked={selectedIds.includes(d.id)} onCheckedChange={() => toggle(d.id)} />
                        <label htmlFor={`device-${d.id}`} className="flex-1 cursor-pointer text-sm">
                          {d.name} <span className="text-muted-foreground text-xs">({d.orgName})</span>
                        </label>
                      </div>
                    ))}
                  </div>
                  <p className="text-muted-foreground text-xs">{selectedIds.length} selected</p>
                </div>
              )}
            </div>
          </FormField>

          <FormField label="Start date & time">
            <Input type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} />
          </FormField>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Duration">
              <Input type="number" min={1} value={durationValue} onChange={(e) => setDurationValue(Number(e.target.value))} />
            </FormField>
            <FormField label="Unit">
              <Select value={durationUnit} onValueChange={(v) => setDurationUnit(v as DurationUnit)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="seconds">Seconds</SelectItem>
                  <SelectItem value="minutes">Minutes</SelectItem>
                  <SelectItem value="hours">Hours</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
          </div>

          <FormField label="Target alert count" hint="Approximate — actual count depends on each device's poll interval and its rules' debounce settings.">
            <Input type="number" min={0} value={targetAlertCount} onChange={(e) => setTargetAlertCount(Number(e.target.value))} />
          </FormField>

          <div className="text-muted-foreground space-y-1 text-xs">
            <p>
              {activeDevices.length} device(s) · ~{estimatedSamples.toLocaleString()} samples
              {estimatedSamples > MAX_SAMPLES * 0.9 && <span className="text-destructive"> — close to the {MAX_SAMPLES.toLocaleString()} limit</span>}
            </p>
            {endPreview && (
              <p>
                Window: {format(new Date(startAt), "PPp")} → {format(endPreview, "PPp")}
              </p>
            )}
          </div>

          {formError && <p className="text-destructive text-sm">{formError}</p>}

          <Button onClick={openConfirm} disabled={pending}>
            {pending ? <Spinner /> : null}
            Run simulation
          </Button>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardContent className="space-y-1 p-5 text-sm">
            <p className="font-medium">Last run</p>
            <p className="text-muted-foreground">Devices processed: {result.devicesProcessed}</p>
            <p className="text-muted-foreground">Samples written: {result.samplesWritten.toLocaleString()}</p>
            <p className="text-muted-foreground">Incidents created: {result.incidentsCreated}</p>
            <p className="text-muted-foreground">
              Range: {format(new Date(result.timeRange.from), "PPp")} → {format(new Date(result.timeRange.to), "PPp")}
            </p>
          </CardContent>
        </Card>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Overwrite data in this window?</AlertDialogTitle>
            <AlertDialogDescription>
              This generates metric history and alerts for {activeDevices.length} device(s), overwriting any existing data at the same
              timestamps. Generated data cannot be told apart from real data afterward, and this cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
            <Button variant="destructive" onClick={submit} disabled={pending}>
              {pending ? <Spinner /> : "Run simulation"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
