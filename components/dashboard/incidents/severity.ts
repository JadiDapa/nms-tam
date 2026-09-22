import { Info, Siren, TriangleAlert, type LucideIcon } from "lucide-react";

// One look per severity, used by the incident log, the rule cards and the charts so red always means critical.
export const SEVERITY_STYLE: Record<string, { icon: LucideIcon; label: string; chip: string; rail: string; dot: string; color: string }> = {
  critical: { icon: Siren, label: "Critical", chip: "bg-red-500/10 text-red-600 dark:text-red-500", rail: "bg-red-500", dot: "bg-red-500", color: "#ef4444" },
  warning: { icon: TriangleAlert, label: "Warning", chip: "bg-amber-500/10 text-amber-600 dark:text-amber-500", rail: "bg-amber-500", dot: "bg-amber-500", color: "#f59e0b" },
  info: { icon: Info, label: "Info", chip: "bg-blue-500/10 text-blue-600 dark:text-blue-500", rail: "bg-blue-500", dot: "bg-blue-500", color: "#3b82f6" },
};

export const SEVERITY_ORDER = ["critical", "warning", "info"] as const;

export const severityOf = (s: string) => SEVERITY_STYLE[s] ?? SEVERITY_STYLE.info;
