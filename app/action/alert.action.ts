"use server";

import { revalidatePath } from "next/cache";
import { run } from "@/lib/action";
import { assertClient } from "@/lib/auth";
import type { RuleInput } from "@/servers/validators/monitoring.validator";
import { AlertConfigService } from "@/servers/services/alert-config.service";

export async function createAlertRules(input: RuleInput) {
  return run(async () => {
    const { user, orgId } = await assertClient();
    const created = await AlertConfigService.createRules(user, orgId, input);
    revalidatePath("/dashboard/alerts");
    return created;
  });
}

export async function updateAlertRule(ruleId: number, input: RuleInput) {
  return run(async () => {
    const { user, orgId } = await assertClient();
    await AlertConfigService.updateRule(user, orgId, ruleId, input);
    revalidatePath("/dashboard/alerts");
  });
}

export async function setAlertRuleEnabled(ruleId: number, enabled: boolean) {
  return run(async () => {
    const { user, orgId } = await assertClient();
    await AlertConfigService.setRuleEnabled(user, orgId, ruleId, enabled);
    revalidatePath("/dashboard/alerts");
  });
}

export async function deleteAlertRule(ruleId: number) {
  return run(async () => {
    const { user, orgId } = await assertClient();
    await AlertConfigService.deleteRule(user, orgId, ruleId);
    revalidatePath("/dashboard/alerts");
  });
}
