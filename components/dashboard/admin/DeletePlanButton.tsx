"use client";

import { Button } from "@/components/ui/button";
import ConfirmAction from "../ConfirmAction";
import { deletePlan } from "@/app/action/plan.action";

export default function DeletePlanButton({ planId }: { planId: number }) {
  return (
    <ConfirmAction
      trigger={<Button variant="outline" size="sm" className="text-destructive h-7">Delete</Button>}
      title="Delete this plan?"
      description="Nobody uses it, so it can be removed."
      confirmLabel="Delete plan"
      destructive
      successMessage="Plan deleted"
      onConfirm={() => deletePlan(planId)}
    />
  );
}
