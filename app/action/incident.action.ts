"use server";

import { revalidatePath } from "next/cache";
import { run } from "@/lib/action";
import { assertClient } from "@/lib/auth";
import { IncidentService } from "@/servers/services/incident.service";
import { IncidentAiService } from "@/servers/services/incident-ai.service";
import { ResourceService } from "@/servers/services/resource.service";

export async function acknowledgeIncident(incidentId: string) {
  return run(async () => {
    const { user, orgId } = await assertClient();
    await IncidentService.acknowledge(user, orgId, incidentId);
    revalidatePath("/dashboard/incidents");
    revalidatePath(`/dashboard/incidents/${incidentId}`);
    revalidatePath("/dashboard");
  });
}

// Everything the detail sheet shows, loaded when it opens.
export async function getIncidentDetail(incidentId: string) {
  return run(async () => {
    const { orgId } = await assertClient();
    const [{ incident, deliverySummary, device }, channels] = await Promise.all([
      IncidentService.get(orgId, incidentId),
      ResourceService.listByOrg(orgId, "CHANNEL"),
    ]);
    return {
      incident,
      device: { id: device.id, name: device.name },
      deliveries: deliverySummary.map((d) => ({ ...d, channelName: channels.find((c) => c.engineId === d.channelId)?.label ?? "removed channel" })),
      aiEnabled: IncidentAiService.enabled(),
      analysis: await IncidentAiService.saved(orgId, incident.id),
    };
  });
}

// Runs a new AI analysis and stores it (the first one, or "Regenerate").
export async function analyzeIncident(incidentId: string) {
  return run(async () => {
    const { user, orgId } = await assertClient();
    return IncidentAiService.analyze(user, orgId, incidentId);
  });
}
