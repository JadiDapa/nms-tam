"use server";

import z from "zod";
import { run } from "@/lib/action";
import { assertAdmin } from "@/lib/auth";
import { SimulateSchema } from "@/servers/validators/simulate.validator";
import { SimulateService } from "@/servers/services/simulate.service";
import { AuditService } from "@/servers/services/audit.service";

// Starts the job and returns immediately; the caller polls getSimulationProgress(jobId) for live progress.
export async function simulateHistoricalData(input: z.input<typeof SimulateSchema>) {
  return run(async () => {
    const admin = await assertAdmin();
    const data = SimulateSchema.parse(input);
    const started = await SimulateService.run(data);
    await AuditService.log({
      actorId: admin.id,
      action: "admin.simulate",
      metadata: {
        accountId: data.accountId,
        scope: data.scope,
        deviceCount: data.deviceIds.length || null,
        startDate: data.startDate.toISOString(),
        endDate: data.endDate.toISOString(),
        windows: data.windows,
        defaultTrafficMinBps: data.defaultTrafficMinBps,
        defaultTrafficMaxBps: data.defaultTrafficMaxBps,
        ...started,
      },
    });
    return started;
  });
}

export async function getSimulationProgress(jobId: string) {
  return run(async () => {
    await assertAdmin();
    return SimulateService.status(jobId);
  });
}
