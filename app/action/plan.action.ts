"use server";

import { revalidatePath } from "next/cache";
import z from "zod";
import { run } from "@/lib/action";
import { assertAdmin } from "@/lib/auth";
import { CreatePlanSchema, UpdatePlanSchema } from "@/servers/validators/plan.validator";
import { PlanService } from "@/servers/services/plan.service";
import { AuditService } from "@/servers/services/audit.service";

export async function createPlan(input: z.input<typeof CreatePlanSchema>) {
  return run(async () => {
    const admin = await assertAdmin();
    const data = CreatePlanSchema.parse(input);
    const plan = await PlanService.create(data);
    await AuditService.log({ actorId: admin.id, action: "plan.create", targetType: "Plan", targetId: plan.id, metadata: { name: plan.name } });
    revalidatePath("/dashboard/admin/plans");
  });
}

export async function updatePlan(planId: number, input: z.input<typeof UpdatePlanSchema>) {
  return run(async () => {
    const admin = await assertAdmin();
    const data = UpdatePlanSchema.parse(input);
    await PlanService.update(planId, data);
    await AuditService.log({ actorId: admin.id, action: "plan.update", targetType: "Plan", targetId: planId, metadata: data });
    revalidatePath("/dashboard/admin/plans");
  });
}

export async function deletePlan(planId: number) {
  return run(async () => {
    const admin = await assertAdmin();
    await PlanService.delete(planId);
    await AuditService.log({ actorId: admin.id, action: "plan.delete", targetType: "Plan", targetId: planId });
    revalidatePath("/dashboard/admin/plans");
  });
}
