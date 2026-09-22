import { notFound } from "next/navigation";
import { requireClient } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import PageHeader from "@/components/dashboard/PageHeader";
import AlertRuleForm from "@/components/dashboard/alerts/AlertRuleForm";
import { AlertConfigService } from "@/servers/services/alert-config.service";
import { ResourceService } from "@/servers/services/resource.service";
import { SubscriptionService } from "@/servers/services/subscription.service";
import type { RuleInput } from "@/servers/validators/monitoring.validator";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function EditAlertRulePage({ params }: Props) {
  const { orgId } = await requireClient();
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();

  let data;
  try {
    data = await AlertConfigService.getRule(orgId, id);
  } catch (err) {
    if (err instanceof AppError && err.status === 404) notFound();
    throw err;
  }
  const [channels, ent] = await Promise.all([
    ResourceService.listByOrg(orgId, "CHANNEL"),
    SubscriptionService.getEntitlements(orgId),
  ]);
  const { rule, device } = data;

  const values: RuleInput = {
    name: rule.name,
    deviceId: device?.id ?? "all",
    conditionType: rule.conditionType,
    metric: rule.metric ?? undefined,
    operator: (rule.operator ?? undefined) as RuleInput["operator"],
    threshold: rule.threshold ?? undefined,
    severity: rule.severity,
    triggerAfter: rule.triggerAfter,
    clearAfter: rule.clearAfter,
    cooldownSec: rule.cooldownSec,
    notifyOnRecovery: rule.notifyOnRecovery,
    enabled: rule.enabled,
    channelIds: data.channelIds,
  };

  return (
    <main className="w-full space-y-6">
      <PageHeader title="Edit Alert Rule" subtitle={device ? `Device: ${device.name}` : undefined} />
      {!ent.live && <p className="text-muted-foreground text-sm">Your subscription is not active, so rules cannot be changed.</p>}
      <AlertRuleForm devices={[]} channels={channels.map((c) => ({ id: c.id, label: c.label }))} existing={{ id, values }} />
    </main>
  );
}
