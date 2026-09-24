"use server";

import z from "zod";
import { run } from "@/lib/action";
import { assertAdmin } from "@/lib/auth";
import { SimulateSchema } from "@/servers/validators/simulate.validator";
import { SimulateService } from "@/servers/services/simulate.service";
import { AuditService } from "@/servers/services/audit.service";

export async function simulateHistoricalData(input: z.input<typeof SimulateSchema>) {
  return run(async () => {
    const admin = await assertAdmin();
    const data = SimulateSchema.parse(input);
    const result = await SimulateService.run(data);
    await AuditService.log({
      actorId: admin.id,
      action: "admin.simulate",
      metadata: {
        scope: data.scope,
        deviceCount: data.deviceIds.length || null,
        startAt: data.startAt.toISOString(),
        durationValue: data.durationValue,
        durationUnit: data.durationUnit,
        targetAlertCount: data.targetAlertCount,
        ...result,
      },
    });
    return result;
  });
}
