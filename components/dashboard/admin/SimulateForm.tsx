"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import { CalendarRange, CircleCheck, CircleX, Clock, HardDrive, ListChecks, Plus, Trash2, Waypoints } from "lucide-react";
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
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import FormField from "../FormField";
import { getSimulationProgress, simulateHistoricalData } from "@/app/action/simulate.action";
import type { SimulateJobStatus } from "@/servers/engine/engine-types";

const POLL_MS = 1000;

type DeviceOption = { id: number; name: string; groupName: string | null; pollIntervalSec: number };
type Account = { id: number; label: string; devices: DeviceOption[] };

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

type Unit = "Kbps" | "Mbps" | "Gbps";
const UNIT_MULTIPLIER: Record<Unit, number> = { Kbps: 1_000, Mbps: 1_000_000, Gbps: 1_000_000_000 };

type WindowRow = {
  id: string;
  weekdays: number[];
  dailyStart: string;
  dailyEnd: string;
  trafficMin: number;
  trafficMax: number;
  unit: Unit;
};

const newWindow = (): WindowRow => ({
  id: Math.random().toString(36).slice(2),
  weekdays: [1, 2, 3, 4, 5],
  dailyStart: "07:00:00",
  dailyEnd: "16:00:00",
  trafficMin: 2,
  trafficMax: 2.6,
  unit: "Gbps",
});

const secOfDay = (hms: string): number => {
  const [h, m, s] = hms.split(":").map(Number);
  return (h ?? 0) * 3600 + (m ?? 0) * 60 + (s ?? 0);
};

const formatDuration = (ms: number): string => {
  const s = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0 ? `${h}h ${m}m ${sec}s` : m > 0 ? `${m}m ${sec}s` : `${sec}s`;
};

export default function SimulateForm({ accounts }: { accounts: Account[] }) {
  const [accountId, setAccountId] = useState<number | null>(null);
  const [scope, setScope] = useState<"all" | "selected">("all");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [search, setSearch] = useState("");

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [windows, setWindows] = useState<WindowRow[]>([newWindow()]);

  const [defaultMin, setDefaultMin] = useState(100);
  const [defaultMax, setDefaultMax] = useState(800);
  const [defaultUnit, setDefaultUnit] = useState<Unit>("Kbps");

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [progress, setProgress] = useState<SimulateJobStatus | null>(null);
  const [now, setNow] = useState(0);
  const [pending, startTransition] = useTransition();
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Poll for progress while a job is running; stop as soon as it lands on done/error.
  useEffect(() => {
    if (!jobId) return;
    const tick = async () => {
      const r = await getSimulationProgress(jobId);
      setNow(Date.now());
      if (!r.ok) {
        toast.error(r.error);
        setJobId(null);
        return;
      }
      setProgress(r.data);
      if (r.data.status !== "running" && pollTimer.current) {
        clearInterval(pollTimer.current);
        pollTimer.current = null;
      }
    };
    void tick();
    pollTimer.current = setInterval(() => void tick(), POLL_MS);
    return () => {
      if (pollTimer.current) clearInterval(pollTimer.current);
      pollTimer.current = null;
    };
  }, [jobId]);

  const account = accounts.find((a) => a.id === accountId) ?? null;
  const filtered = useMemo(() => {
    const matches = account ? account.devices.filter((d) => d.name.toLowerCase().includes(search.toLowerCase())) : [];
    return matches.map((d, i) => ({ ...d, showHeader: i === 0 || d.groupName !== matches[i - 1]!.groupName }));
  }, [account, search]);
  const activeDevices = useMemo(
    () => (!account ? [] : scope === "all" ? account.devices : account.devices.filter((d) => selectedIds.includes(d.id))),
    [account, scope, selectedIds],
  );

  function toggleDevice(id: number) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function toggleWeekday(windowId: string, day: number) {
    setWindows((prev) =>
      prev.map((w) => (w.id === windowId ? { ...w, weekdays: w.weekdays.includes(day) ? w.weekdays.filter((d) => d !== day) : [...w.weekdays, day].sort() } : w)),
    );
  }

  function updateWindow(windowId: string, patch: Partial<WindowRow>) {
    setWindows((prev) => prev.map((w) => (w.id === windowId ? { ...w, ...patch } : w)));
  }

  function addWindow() {
    setWindows((prev) => [...prev, newWindow()]);
  }

  function removeWindow(windowId: string) {
    setWindows((prev) => prev.filter((w) => w.id !== windowId));
  }

  // Every tick in the range now gets a value (a window's, or the default), so the total no longer depends on
  // which windows are configured — only on the date range and each device's poll interval.
  const estimatedTicks = useMemo(() => {
    if (!startDate || !endDate || activeDevices.length === 0) return 0;
    const start = new Date(startDate).getTime();
    const end = new Date(endDate).getTime() + 86_400_000; // inclusive of the end date
    if (end <= start) return 0;
    return activeDevices.reduce((sum, d) => sum + Math.floor((end - start) / (Math.max(1, d.pollIntervalSec) * 1000)), 0);
  }, [startDate, endDate, activeDevices]);

  function openConfirm() {
    setFormError(null);
    if (!accountId) return setFormError("Select an account");
    if (!startDate || !endDate) return setFormError("Pick a start and end date");
    if (scope === "selected" && selectedIds.length === 0) return setFormError("Pick at least one device");
    for (const w of windows) {
      if (w.weekdays.length === 0) return setFormError("Each time window needs at least one weekday");
      if (secOfDay(w.dailyEnd) <= secOfDay(w.dailyStart)) return setFormError("Each time window's daily end time must be after its daily start time");
      if (w.trafficMax <= w.trafficMin) return setFormError("Each time window's traffic max must be greater than its traffic min");
    }
    if (defaultMax <= defaultMin) return setFormError("Default traffic max must be greater than default traffic min");
    setConfirmOpen(true);
  }

  function submit() {
    if (!accountId) return;
    startTransition(async () => {
      const r = await simulateHistoricalData({
        accountId,
        scope,
        deviceIds: scope === "selected" ? selectedIds : [],
        startDate: new Date(`${startDate}T00:00:00Z`),
        endDate: new Date(`${endDate}T00:00:00Z`),
        windows: windows.map((w) => ({
          weekdays: w.weekdays,
          dailyStartSec: secOfDay(w.dailyStart),
          dailyEndSec: secOfDay(w.dailyEnd),
          trafficMinBps: w.trafficMin * UNIT_MULTIPLIER[w.unit],
          trafficMaxBps: w.trafficMax * UNIT_MULTIPLIER[w.unit],
        })),
        defaultTrafficMinBps: defaultMin * UNIT_MULTIPLIER[defaultUnit],
        defaultTrafficMaxBps: defaultMax * UNIT_MULTIPLIER[defaultUnit],
      });
      if (!r.ok) {
        toast.error(r.error);
        return;
      }
      setConfirmOpen(false);
      const startedAt = new Date();
      setNow(startedAt.getTime());
      setProgress({
        status: "running",
        startedAt: startedAt.toISOString(),
        totalSamples: r.data.totalSamples,
        samplesWritten: 0,
        devicesTotal: r.data.devicesTotal,
        devicesProcessed: 0,
        interfacesProcessed: 0,
        devices: [],
        result: null,
        error: null,
      });
      setJobId(r.data.jobId);
    });
  }

  const pct = progress && progress.totalSamples > 0 ? (progress.samplesWritten / progress.totalSamples) * 100 : 0;
  const elapsedMs = progress ? now - new Date(progress.startedAt).getTime() : 0;
  const etaMs = progress?.status === "running" && pct > 0 ? (elapsedMs / pct) * (100 - pct) : null;

  return (
    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <Card>
        <CardContent className="space-y-5 p-5">
          <FormField label="Account">
            <Select
              value={accountId === null ? undefined : String(accountId)}
              onValueChange={(v) => {
                setAccountId(Number(v));
                setSelectedIds([]);
                setScope("all");
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select an account…" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={String(a.id)}>
                    {a.label} ({a.devices.length} device{a.devices.length === 1 ? "" : "s"})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>

          {account && (
            <FormField label="Devices">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Checkbox id="scope-all" checked={scope === "all"} onCheckedChange={(c) => setScope(c ? "all" : "selected")} />
                  <label htmlFor="scope-all" className="text-sm">
                    All devices ({account.devices.length})
                  </label>
                </div>
                {scope === "selected" && (
                  <div className="space-y-2 rounded-md border p-2">
                    <Input placeholder="Search devices…" value={search} onChange={(e) => setSearch(e.target.value)} />
                    <div className="max-h-56 space-y-0.5 overflow-y-auto">
                      {filtered.length === 0 && <p className="text-muted-foreground p-2 text-sm">No devices match.</p>}
                      {filtered.map((d) => {
                        const showHeader = d.showHeader;
                        return (
                          <div key={d.id}>
                            {showHeader && <p className="text-muted-foreground px-1 pt-2 pb-1 text-xs font-medium">{d.groupName ?? "Ungrouped"}</p>}
                            <div className="flex items-center gap-2 rounded px-1 py-1 hover:bg-accent">
                              <Checkbox id={`device-${d.id}`} checked={selectedIds.includes(d.id)} onCheckedChange={() => toggleDevice(d.id)} />
                              <label htmlFor={`device-${d.id}`} className="flex-1 cursor-pointer text-sm">
                                {d.name}
                              </label>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <p className="text-muted-foreground text-xs">{selectedIds.length} selected</p>
                  </div>
                )}
              </div>
            </FormField>
          )}

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Start date">
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </FormField>
            <FormField label="End date">
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </FormField>
          </div>

          <FormField label="Time windows" hint="Checked top to bottom — the first window whose weekdays and time cover a moment wins. Anything not covered by any window falls back to the default below. Values ease from one window's range into the next instead of jumping.">
            <div className="space-y-3">
              {windows.map((w, i) => (
                <div key={w.id} className="space-y-3 rounded-md border p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-muted-foreground text-xs font-medium">Window {i + 1}</p>
                    <Button type="button" size="icon" variant="ghost" className="size-6" onClick={() => removeWindow(w.id)}>
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {WEEKDAY_LABELS.map((label, day) => (
                      <Button
                        key={day}
                        type="button"
                        size="sm"
                        variant={w.weekdays.includes(day) ? "default" : "outline"}
                        onClick={() => toggleWeekday(w.id, day)}
                      >
                        {label}
                      </Button>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <FormField label="Daily start time">
                      <Input type="time" step={1} value={w.dailyStart} onChange={(e) => updateWindow(w.id, { dailyStart: e.target.value })} />
                    </FormField>
                    <FormField label="Daily end time">
                      <Input type="time" step={1} value={w.dailyEnd} onChange={(e) => updateWindow(w.id, { dailyEnd: e.target.value })} />
                    </FormField>
                  </div>

                  <FormField label="Traffic target range">
                    <div className="flex items-center gap-2">
                      <Input type="number" min={0} step={0.1} value={w.trafficMin} onChange={(e) => updateWindow(w.id, { trafficMin: Number(e.target.value) })} />
                      <span className="text-muted-foreground text-sm">to</span>
                      <Input type="number" min={0} step={0.1} value={w.trafficMax} onChange={(e) => updateWindow(w.id, { trafficMax: Number(e.target.value) })} />
                      <Select value={w.unit} onValueChange={(v) => updateWindow(w.id, { unit: v as Unit })}>
                        <SelectTrigger className="w-24">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Kbps">Kbps</SelectItem>
                          <SelectItem value="Mbps">Mbps</SelectItem>
                          <SelectItem value="Gbps">Gbps</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </FormField>
                </div>
              ))}

              <Button type="button" size="sm" variant="secondary" onClick={addWindow}>
                <Plus className="size-3.5" />
                Add time window
              </Button>
            </div>
          </FormField>

          <FormField label="Default traffic range" hint="Used for any moment not covered by a time window above, and if no time windows are set at all.">
            <div className="flex items-center gap-2">
              <Input type="number" min={0} step={0.1} value={defaultMin} onChange={(e) => setDefaultMin(Number(e.target.value))} />
              <span className="text-muted-foreground text-sm">to</span>
              <Input type="number" min={0} step={0.1} value={defaultMax} onChange={(e) => setDefaultMax(Number(e.target.value))} />
              <Select value={defaultUnit} onValueChange={(v) => setDefaultUnit(v as Unit)}>
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Kbps">Kbps</SelectItem>
                  <SelectItem value="Mbps">Mbps</SelectItem>
                  <SelectItem value="Gbps">Gbps</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </FormField>

          <div className="text-muted-foreground space-y-1 text-xs">
            <p>
              {activeDevices.length} device(s) · ~{estimatedTicks.toLocaleString()} ticks per interface
            </p>
          </div>

          {formError && <p className="text-destructive text-sm">{formError}</p>}

          <Button onClick={openConfirm} disabled={pending || progress?.status === "running"}>
            {pending ? <Spinner /> : null}
            Run simulation
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-4 lg:sticky lg:top-6">
        {!progress && (
          <Card>
            <CardContent className="text-muted-foreground flex flex-col items-center gap-2 p-8 text-center text-sm">
              <ListChecks className="size-6" />
              <p>Progress for a running or finished simulation shows up here.</p>
            </CardContent>
          </Card>
        )}

        {progress?.status === "running" && (
          <Card>
            <CardContent className="space-y-4 p-5">
              <div className="flex items-center justify-between text-sm">
                <p className="flex items-center gap-2 font-medium">
                  <Spinner className="size-4" />
                  Generating…
                </p>
                <p className="text-muted-foreground tabular-nums">{Math.round(pct)}%</p>
              </div>
              <Progress value={pct} />
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs">Samples written</p>
                  <p className="font-medium tabular-nums">
                    {progress.samplesWritten.toLocaleString()} / {progress.totalSamples.toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Devices</p>
                  <p className="font-medium tabular-nums">
                    {progress.devicesProcessed} / {progress.devicesTotal}
                  </p>
                </div>
                <div className="flex items-start gap-1.5">
                  <Clock className="text-muted-foreground mt-0.5 size-3.5 shrink-0" />
                  <div>
                    <p className="text-muted-foreground text-xs">Elapsed</p>
                    <p className="font-medium tabular-nums">{formatDuration(elapsedMs)}</p>
                  </div>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Est. remaining</p>
                  <p className="font-medium tabular-nums">{etaMs === null ? "—" : formatDuration(etaMs)}</p>
                </div>
              </div>

              {progress.devices.length > 0 && (
                <div className="max-h-64 space-y-2 overflow-y-auto border-t pt-3">
                  {progress.devices.map((d) => {
                    const devicePct = d.samplesTotal > 0 ? (d.samplesWritten / d.samplesTotal) * 100 : 0;
                    return (
                      <div key={d.deviceId} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="truncate font-medium">{d.deviceName}</span>
                          <span className="text-muted-foreground shrink-0 tabular-nums">
                            {d.status === "pending" ? "queued" : `${d.interfacesDone}/${d.interfacesTotal} interfaces`}
                          </span>
                        </div>
                        <Progress value={devicePct} className="h-1.5" />
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {progress?.status === "error" && (
          <Card className="border-destructive/30">
            <CardContent className="flex items-center gap-2 p-5 text-sm">
              <CircleX className="text-destructive size-4 shrink-0" />
              <p>Simulation failed: {progress.error}</p>
            </CardContent>
          </Card>
        )}

        {progress?.status === "done" && progress.result && (
          <Card className="border-green-500/30">
            <CardContent className="space-y-4 p-5">
              <p className="flex items-center gap-2 text-sm font-medium">
                <CircleCheck className="size-4 text-green-600 dark:text-green-500" />
                Last run completed
              </p>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex items-start gap-2.5">
                  <HardDrive className="text-muted-foreground mt-0.5 size-4 shrink-0" />
                  <div>
                    <p className="text-muted-foreground text-xs">Devices processed</p>
                    <p className="font-medium">{progress.result.devicesProcessed}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <Waypoints className="text-muted-foreground mt-0.5 size-4 shrink-0" />
                  <div>
                    <p className="text-muted-foreground text-xs">Interfaces processed</p>
                    <p className="font-medium">{progress.result.interfacesProcessed}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <CalendarRange className="text-muted-foreground mt-0.5 size-4 shrink-0" />
                  <div>
                    <p className="text-muted-foreground text-xs">Samples written</p>
                    <p className="font-medium">{progress.result.samplesWritten.toLocaleString()}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <Clock className="text-muted-foreground mt-0.5 size-4 shrink-0" />
                  <div>
                    <p className="text-muted-foreground text-xs">Took</p>
                    <p className="font-medium">{formatDuration(elapsedMs)}</p>
                  </div>
                </div>
              </div>
              <p className="text-muted-foreground text-xs">
                Range: {format(new Date(progress.result.timeRange.from), "PPp")} → {format(new Date(progress.result.timeRange.to), "PPp")}
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Overwrite traffic data in this window?</AlertDialogTitle>
            <AlertDialogDescription>
              This generates interface traffic history for {activeDevices.length} device(s), overwriting any existing data at the same
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
