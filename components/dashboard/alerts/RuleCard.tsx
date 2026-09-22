"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Globe, Mail, Pencil, Send, Trash2, Webhook, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { StatusBadge } from "../StatusBadge";
import ConfirmAction from "../ConfirmAction";
import { severityOf } from "../incidents/severity";
import { deleteAlertRule, setAlertRuleEnabled } from "@/app/action/alert.action";

export type RuleCardData = {
  id: number;
  name: string;
  severity: string;
  enabled: boolean;
  // "CPU usage goes above 90%" and "3 checks in a row to alert · ..."
  headline: string;
  timing: string;
  // "All devices" or the name of the one device it watches
  scope: string;
  scopeDeviceId: number | null;
  channels: { label: string; type: string; enabled: boolean }[];
  activeIncidents: number;
};

const CHANNEL_ICON: Record<string, LucideIcon> = { telegram: Send, webhook: Webhook, email: Mail };

// One alert rule, written as a sentence: what it watches for, how strict it is, and who is told.
export default function RuleCard({ rule, canChange }: { rule: RuleCardData; canChange: boolean }) {
  const [, startTransition] = useTransition();
  const router = useRouter();
  const sev = severityOf(rule.severity);

  return (
    <article className={cn("bg-card flex flex-col gap-5 rounded-3xl p-6 shadow-xs transition-opacity", !rule.enabled && "opacity-75")}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-2.5">
          <div className="flex items-center gap-2">
            <span className={cn("h-1 w-7 rounded-full", sev.rail)} />
            <span className={cn("text-[11px] font-semibold tracking-wide uppercase", sev.chip.split(" ").slice(1).join(" "))}>{sev.label}</span>
            {!rule.enabled && <span className="bg-muted text-muted-foreground rounded-[6px] px-1.5 py-0.5 text-[11px] font-medium">Paused</span>}
          </div>
          <h3 className="text-foreground/80 truncate text-sm font-medium">{rule.name}</h3>
        </div>
        <Switch
          checked={rule.enabled}
          disabled={!canChange}
          aria-label={rule.enabled ? "Pause this rule" : "Turn this rule on"}
          onCheckedChange={(v) =>
            startTransition(async () => {
              const r = await setAlertRuleEnabled(rule.id, v);
              if (!r.ok) return void toast.error(r.error);
              router.refresh();
            })
          }
        />
      </div>

      <div className="space-y-2">
        <p className="text-muted-foreground text-xs">Alert when</p>
        <p className="text-xl leading-snug font-medium tracking-tight">{rule.headline}</p>
        <p className="text-muted-foreground text-xs">{rule.timing}</p>
      </div>

      <dl className="bg-muted space-y-3 rounded-2xl p-4 text-sm">
        <div className="flex items-center justify-between gap-4">
          <dt className="text-muted-foreground flex shrink-0 items-center gap-2 text-xs font-medium">
            <Globe className="size-3.5" />
            Watches
          </dt>
          <dd className="min-w-0 text-right font-medium">
            {rule.scopeDeviceId ? (
              <Link href={`/dashboard/devices/${rule.scopeDeviceId}`} className="hover:underline">
                {rule.scope}
              </Link>
            ) : (
              rule.scope
            )}
          </dd>
        </div>
        <div className="flex items-start justify-between gap-4">
          <dt className="text-muted-foreground flex shrink-0 items-center gap-2 text-xs font-medium">
            <Send className="size-3.5" />
            Tells
          </dt>
          <dd className="flex min-w-0 flex-wrap justify-end gap-1.5">
            {rule.channels.length === 0 ? (
              <span className="text-muted-foreground text-xs">nobody, dashboard only</span>
            ) : (
              rule.channels.map((c) => {
                const Icon = CHANNEL_ICON[c.type] ?? Send;
                return (
                  <span key={c.label} className={cn("bg-card inline-flex items-center gap-1.5 rounded-[6px] px-2 py-1 text-xs font-medium", !c.enabled && "text-muted-foreground line-through")} title={c.enabled ? c.type : `${c.type} (channel is off)`}>
                    <Icon className="size-3" />
                    {c.label}
                  </span>
                );
              })
            )}
          </dd>
        </div>
      </dl>

      <div className="mt-auto flex items-center justify-between gap-3">
        {rule.activeIncidents > 0 ? (
          <Link href="/dashboard/incidents" className="hover:opacity-80">
            <StatusBadge label={`${rule.activeIncidents} open`} tone="red" />
          </Link>
        ) : (
          <span className="text-muted-foreground text-xs">No open incidents</span>
        )}
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm" className="rounded-xl">
            <Link href={`/dashboard/alerts/${rule.id}`}>
              <Pencil />
              Edit
            </Link>
          </Button>
          <ConfirmAction
            trigger={
              <Button variant="ghost" size="icon-sm" className="rounded-xl text-red-600 hover:text-red-600 dark:text-red-400 dark:hover:text-red-400" aria-label="Delete rule">
                <Trash2 />
              </Button>
            }
            title="Delete this alert rule?"
            description="Open incidents of this rule are closed. This cannot be undone."
            confirmLabel="Delete rule"
            destructive
            successMessage="Rule deleted"
            onConfirm={() => deleteAlertRule(rule.id)}
          />
        </div>
      </div>
    </article>
  );
}
