import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Tone = "green" | "red" | "yellow" | "blue" | "gray";

const TONES: Record<Tone, string> = {
  green: "bg-green-500/10 text-green-600 dark:text-green-500",
  red: "bg-red-500/10 text-red-600 dark:text-red-500",
  yellow: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-500",
  blue: "bg-blue-500/10 text-blue-600 dark:text-blue-500",
  gray: "bg-muted text-muted-foreground",
};

export function StatusBadge({ label, tone, className, icon }: { label: string; tone: Tone; className?: string; icon?: ReactNode }) {
  return (
    <span className={cn("inline-flex items-center gap-0.5 rounded-[6px] px-2 py-1 text-xs font-medium whitespace-nowrap", TONES[tone], className)}>
      {icon}
      {label}
    </span>
  );
}

const HEALTH: Record<string, Tone> = { UP: "green", DOWN: "red", DEGRADED: "yellow", RECOVERING: "blue", UNKNOWN: "gray" };
export const HealthBadge = ({ state }: { state: string }) => (
  <StatusBadge label={state} tone={HEALTH[state] ?? "gray"} />
);

const SEVERITY: Record<string, Tone> = { critical: "red", warning: "yellow", info: "blue" };
export const SeverityBadge = ({ severity }: { severity: string }) => (
  <StatusBadge label={severity.toUpperCase()} tone={SEVERITY[severity] ?? "gray"} />
);

const INCIDENT: Record<string, Tone> = { OPEN: "red", ACKNOWLEDGED: "yellow", RESOLVED: "green" };
export const IncidentBadge = ({ status }: { status: string }) => (
  <StatusBadge label={status} tone={INCIDENT[status] ?? "gray"} />
);

const SUBSCRIPTION: Record<string, Tone> = { ACTIVE: "green", EXPIRED: "red", CANCELED: "gray", NONE: "gray" };
export const SubscriptionBadge = ({ status }: { status: string }) => (
  <StatusBadge label={status === "NONE" ? "NO PLAN" : status} tone={SUBSCRIPTION[status] ?? "gray"} />
);

const PHASE: Record<string, Tone> = { SENT: "green", FAILED: "red", RETRYING: "yellow", REQUESTED: "blue" };
export const DeliveryBadge = ({ phase }: { phase: string }) => (
  <StatusBadge label={phase} tone={PHASE[phase] ?? "gray"} />
);
