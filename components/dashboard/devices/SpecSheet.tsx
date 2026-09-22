import { ReactNode } from "react";
import { Globe, MapPin, Tag, Timer, Waypoints, type LucideIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatDate, timeAgo } from "@/lib/format";
import { TYPE_ICON } from "../dashboard/DeviceCard";
import { typeLabel } from "../dashboard/device-list-types";
import CopyButton from "./CopyButton";
import type { EngineDevice } from "@/servers/engine/engine-types";

function Spec({ icon: Icon, label, children, wide, action }: { icon: LucideIcon; label: string; children: ReactNode; wide?: boolean; action?: ReactNode }) {
  return (
    <div className={cn("bg-muted flex min-w-0 flex-col gap-2 rounded-2xl p-4", wide && "sm:col-span-2")}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-muted-foreground flex items-center gap-2 text-xs font-medium">
          <Icon className="size-4" />
          {label}
        </span>
        {action}
      </div>
      <div className="min-w-0 text-sm font-medium">{children}</div>
    </div>
  );
}

const tag = "bg-card text-foreground/80 inline-block rounded-[6px] px-2 py-0.5 text-xs font-medium";

// The device as a data sheet: what it is, how it is watched, and what it says about itself.
export default function SpecSheet({ device }: { device: EngineDevice }) {
  const TypeIcon = TYPE_ICON[device.deviceType] ?? Waypoints;
  const model = [device.vendor, device.model].filter(Boolean).join(" ");
  const checks = [device.icmpEnabled && "Ping", device.tcpPorts.length > 0 && `TCP ${device.tcpPorts.join(", ")}`, device.snmpEnabled && "SNMP"].filter(Boolean) as string[];
  const p = device.polling;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">Device</CardTitle>
        <CardDescription>Identity and how it is monitored</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2">
        <Spec icon={Globe} label="Address" wide action={<CopyButton value={device.host} label="address" />}>
          <span className="font-mono text-base">{device.host}</span>
        </Spec>

        <Spec icon={TypeIcon} label="Type">
          <span className="capitalize">{typeLabel(device.deviceType)}</span>
          {model && <span className="text-muted-foreground block truncate text-xs font-normal">{model}</span>}
        </Spec>

        <Spec icon={Timer} label="Polling">
          every {p.pollIntervalSec} s
          <span className="text-muted-foreground block text-xs font-normal">
            timeout {p.timeoutMs} ms · {p.retryCount} {p.retryCount === 1 ? "retry" : "retries"}
          </span>
        </Spec>

        <Spec icon={Tag} label="Checks">
          <span className="flex flex-wrap gap-1.5">
            {checks.length === 0
              ? "—"
              : checks.map((c) => (
                  <span key={c} className={tag}>
                    {c}
                  </span>
                ))}
          </span>
        </Spec>

        {device.sysName ? (
          <Spec icon={Tag} label="System name" action={<CopyButton value={device.sysName} label="system name" />}>
            <span className="block truncate">{device.sysName}</span>
          </Spec>
        ) : (
          <Spec icon={MapPin} label="Location">
            <span className={cn("block truncate", !device.location && "text-muted-foreground font-normal")}>{device.location ?? "Not set"}</span>
          </Spec>
        )}

        {device.sysDescr && (
          <Spec icon={Tag} label="What the device says about itself" wide>
            <span className="bg-card text-muted-foreground line-clamp-4 block rounded-xl p-3 font-mono text-xs leading-relaxed font-normal break-words">{device.sysDescr}</span>
          </Spec>
        )}

        <p className="text-muted-foreground sm:col-span-2 px-1 text-xs">
          Added {formatDate(device.createdAt)} ({timeAgo(device.createdAt)}) · settings last changed {timeAgo(device.updatedAt)}
        </p>
      </CardContent>
    </Card>
  );
}
