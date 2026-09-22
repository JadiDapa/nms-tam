"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pause, Play, RefreshCw, Stethoscope, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import ConfirmAction from "../ConfirmAction";
import TestResultView from "./TestResultView";
import { HealthBadge } from "../StatusBadge";
import {
  deleteDevice,
  pollDeviceNow,
  setDeviceEnabled,
  testStoredDevice,
} from "@/app/action/device.action";
import type { EnginePollReport, EngineTestResult } from "@/servers/engine/engine-types";
import { formatMs } from "@/lib/format";

type Props = {
  deviceId: number;
  paused: boolean;
  // false when the subscription is not active (changing things is refused server side too)
  canChange: boolean;
};

export default function DeviceActions({ deviceId, paused, canChange }: Props) {
  const [polling, startPolling] = useTransition();
  const [testing, startTesting] = useTransition();
  const [toggling, startToggling] = useTransition();
  const [report, setReport] = useState<EnginePollReport | null>(null);
  const [test, setTest] = useState<EngineTestResult | null>(null);
  const router = useRouter();

  function poll() {
    startPolling(async () => {
      const r = await pollDeviceNow(deviceId);
      if (!r.ok) return void toast.error(r.error);
      setReport(r.data);
      router.refresh();
    });
  }

  function runTest() {
    startTesting(async () => {
      const r = await testStoredDevice(deviceId);
      if (!r.ok) return void toast.error(r.error);
      setTest(r.data);
    });
  }

  function toggle() {
    startToggling(async () => {
      const r = await setDeviceEnabled(deviceId, paused);
      if (!r.ok) return void toast.error(r.error);
      toast.success(paused ? "Monitoring resumed" : "Monitoring paused");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button className="rounded-xl" onClick={poll} disabled={polling || !canChange || paused}>
        {polling ? <Spinner /> : <RefreshCw className="size-4" />}
        Poll now
      </Button>
      <Button variant="outline" className="rounded-xl" onClick={runTest} disabled={testing || !canChange}>
        {testing ? <Spinner /> : <Stethoscope className="size-4" />}
        Test connection
      </Button>
      <Button variant="outline" className="rounded-xl" onClick={toggle} disabled={toggling || (paused && !canChange)}>
        {toggling ? <Spinner /> : paused ? <Play className="size-4" /> : <Pause className="size-4" />}
        {paused ? "Resume" : "Pause"}
      </Button>
      <ConfirmAction
        trigger={
          <Button variant="outline" className="rounded-xl text-red-600 hover:text-red-600 dark:text-red-400 dark:hover:text-red-400">
            <Trash2 className="size-4" />
            Delete
          </Button>
        }
        title="Delete this device?"
        description="Monitoring stops, its history and alert rules are removed, and the slot becomes free. This cannot be undone."
        confirmLabel="Delete device"
        destructive
        successMessage="Device deleted"
        redirectTo="/dashboard/devices"
        onConfirm={() => deleteDevice(deviceId)}
      />

      <Dialog open={report !== null} onOpenChange={(o) => !o && setReport(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Poll result</DialogTitle>
            <DialogDescription>A real poll just ran and was stored like a scheduled one.</DialogDescription>
          </DialogHeader>
          {report && (
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground">State</span>
                <HealthBadge state={report.state.reachability} />
                {report.state.snmp && <HealthBadge state={report.state.snmp} />}
              </div>
              <p>
                Took {formatMs(report.durationMs)} · {report.metricsWritten} metrics and {report.interfaceSamplesWritten} interface samples stored
              </p>
              {report.snmp && (
                <p className="text-muted-foreground">
                  SNMP: {report.snmp.status}
                  {report.snmp.retransmits !== undefined && ` · ${report.snmp.retransmits} retransmits`}
                  {report.snmp.timings &&
                    ` · ${Object.entries(report.snmp.timings)
                      .filter(([, v]) => v !== null)
                      .map(([k, v]) => `${k.replace("Ms", "")} ${v} ms`)
                      .join(", ")}`}
                </p>
              )}
              {report.transitions.map((t, i) => (
                <p key={i}>
                  {t.kind}: {t.from} → {t.to} <span className="text-muted-foreground">({t.reason})</span>
                </p>
              ))}
              {report.errors.length > 0 && (
                <ul className="text-destructive list-disc ps-5">
                  {report.errors.map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={test !== null} onOpenChange={(o) => !o && setTest(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Connection test</DialogTitle>
            <DialogDescription>Nothing is stored by this test.</DialogDescription>
          </DialogHeader>
          {test && <TestResultView result={test} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
