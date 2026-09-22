"use server";

import { revalidatePath } from "next/cache";
import { run } from "@/lib/action";
import { assertAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DeviceMonitorService } from "@/servers/services/device-monitor.service";
import { EngineAdminService, type OrphanKind } from "@/servers/services/engine-admin.service";

export async function deleteOrphan(kind: OrphanKind, engineId: string) {
  return run(async () => {
    const admin = await assertAdmin();
    await EngineAdminService.deleteOrphan(admin.id, kind, engineId);
    revalidatePath("/dashboard/admin/engine");
  });
}

// Re-applies "paused while unpaid, running while paid" to every client. The worker does this on a timer too.
export async function syncAllClients() {
  return run(async () => {
    await assertAdmin();
    const orgs = await prisma.organization.findMany({ select: { id: true } });
    let changed = 0;
    let failed = 0;
    for (const o of orgs) {
      const r = await DeviceMonitorService.syncOrgDevices(o.id);
      changed += r.changed;
      failed += r.failed;
    }
    revalidatePath("/dashboard/admin/engine");
    return { changed, failed };
  });
}
