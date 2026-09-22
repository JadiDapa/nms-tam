"use client";

import { CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import ConfirmAction from "../ConfirmAction";
import { acknowledgeIncident } from "@/app/action/incident.action";

export default function AcknowledgeButton({ incidentId }: { incidentId: string }) {
  return (
    <ConfirmAction
      trigger={
        <Button variant="outline" size="sm" className="rounded-xl">
          <CheckCheck className="size-4" />
          Acknowledge
        </Button>
      }
      title="Acknowledge this incident?"
      description="It stays open until the problem is gone, but it will show that someone has seen it."
      confirmLabel="Acknowledge"
      successMessage="Incident acknowledged"
      onConfirm={() => acknowledgeIncident(incidentId)}
    />
  );
}
