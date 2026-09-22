"use server";

import { revalidatePath } from "next/cache";
import z from "zod";
import { run } from "@/lib/action";
import { assertAdmin } from "@/lib/auth";
import {
  CreateOrganizationSchema,
  UpdateOrganizationSchema,
} from "@/servers/validators/organization.validator";
import { OrganizationService } from "@/servers/services/organization.service";
import { DeviceMonitorService } from "@/servers/services/device-monitor.service";
import { AuditService } from "@/servers/services/audit.service";

export async function createOrganization(input: z.input<typeof CreateOrganizationSchema>) {
  return run(async () => {
    const admin = await assertAdmin();
    const data = CreateOrganizationSchema.parse(input);
    const org = await OrganizationService.create(data);
    await AuditService.log({ actorId: admin.id, orgId: org.id, action: "org.create", targetType: "Organization", targetId: org.id, metadata: { name: org.name } });
    revalidatePath("/dashboard/admin/organizations");
    return org.id;
  });
}

export async function updateOrganization(orgId: number, input: z.input<typeof UpdateOrganizationSchema>) {
  return run(async () => {
    const admin = await assertAdmin();
    const data = UpdateOrganizationSchema.parse(input);
    await OrganizationService.update(orgId, data);
    // suspending or reinstating a client pauses or resumes their monitoring
    if (data.status !== undefined) await DeviceMonitorService.syncOrgDevices(orgId);
    await AuditService.log({ actorId: admin.id, orgId, action: "org.update", targetType: "Organization", targetId: orgId, metadata: data });
    revalidatePath("/dashboard/admin/organizations");
    revalidatePath(`/dashboard/admin/organizations/${orgId}`);
  });
}
