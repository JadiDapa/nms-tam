import Link from "next/link";
import { formatDistanceToNowStrict } from "date-fns";
import { ChevronLeft, CircleHelp, MapPin } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { HealthBadge, StatusBadge } from "../StatusBadge";
import { TYPE_ICON, Beacon } from "../dashboard/DeviceCard";
import { typeLabel } from "../dashboard/device-list-types";
import { mapStateOf } from "../map/map-types";
import DeviceActions from "./DeviceActions";
import PollPulse from "./PollPulse";
import type { EngineDeviceStatus } from "@/servers/engine/engine-types";

type Props = {
  deviceId: number;
  name: string;
  // our own record: SUSPENDED means monitoring is paused
  ownerStatus: string;
  disabledBy: string | null;
  status: EngineDeviceStatus;
  canChange: boolean;
};

const WORD: Record<string, string> = { UP: "Up", DOWN: "Down", DEGRADED: "Degraded", RECOVERING: "Recovering", UNKNOWN: "Status unknown" };

// The device at a glance: what it is, whether it is well, for how long, and what you can do with it.
export default function DeviceHeader({ deviceId, name, ownerStatus, disabledBy, status, canChange }: Props) {
  const paused = ownerStatus === "SUSPENDED";
  const { state, device } = status;
  const reach = state.reachability;
  const TypeIcon = TYPE_ICON[device.deviceType] ?? CircleHelp;
  const beacon = mapStateOf(ownerStatus, reach.state);
  const kind = [typeLabel(device.deviceType), device.vendor, device.model].filter(Boolean).join(" · ");

  const sentence = paused
    ? "Monitoring is paused"
    : reach.since && reach.state !== "UNKNOWN"
      ? `${WORD[reach.state] ?? reach.state} for ${formatDistanceToNowStrict(new Date(reach.since))}`
      : (WORD[reach.state] ?? reach.state);

  return (
    <div className="space-y-3">
      <Link href="/dashboard/devices" className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm transition-colors">
        <ChevronLeft className="size-4" />
        All devices
      </Link>

      <Card>
        <CardContent className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex min-w-0 items-center gap-5">
            <span className="bg-muted relative flex size-16 shrink-0 items-center justify-center rounded-3xl">
              <TypeIcon className="size-8" strokeWidth={1.5} />
              <span className="bg-card absolute -top-1 -right-1 flex rounded-full p-1">
                <Beacon state={beacon} />
              </span>
            </span>

            <div className="min-w-0 space-y-2">
              <h1 className="truncate text-3xl leading-tight font-medium tracking-tight">{name}</h1>
              <p className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                <span className="font-mono">{device.host}</span>
                {kind && <span className="capitalize">{kind}</span>}
                {device.location && (
                  <span className="flex items-center gap-1">
                    <MapPin className="size-3.5" />
                    {device.location}
                  </span>
                )}
              </p>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 pt-1">
                {paused ? (
                  <StatusBadge label={disabledBy === "SUBSCRIPTION" ? "PAUSED BY PLAN" : "PAUSED"} tone="gray" />
                ) : (
                  <HealthBadge state={reach.state} />
                )}
                <span className="text-sm font-medium">{sentence}</span>
                {device.snmpEnabled && !paused && state.snmp.state !== "UNKNOWN" && (
                  <span className="text-muted-foreground flex items-center gap-1.5 text-xs">
                    SNMP <HealthBadge state={state.snmp.state} />
                  </span>
                )}
                {status.activeIncidents > 0 && (
                  <StatusBadge label={`${status.activeIncidents} active incident${status.activeIncidents > 1 ? "s" : ""}`} tone="red" />
                )}
                <PollPulse lastPollAt={state.lastPollAt} intervalSec={device.polling.pollIntervalSec} paused={paused} />
              </div>
            </div>
          </div>

          <DeviceActions deviceId={deviceId} paused={paused} canChange={canChange} />
        </CardContent>
      </Card>
    </div>
  );
}
