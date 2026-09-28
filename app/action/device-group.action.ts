"use server";

import { revalidatePath } from "next/cache";
import { run } from "@/lib/action";
import { assertClient } from "@/lib/auth";
import { DeviceGroupSchema, type DeviceGroupInput } from "@/servers/validators/monitoring.validator";
import { DeviceGroupService } from "@/servers/services/device-group.service";

const refresh = () => {
  revalidatePath("/dashboard/devices");
  revalidatePath("/dashboard/devices/new");
};

export async function createDeviceGroup(raw: DeviceGroupInput) {
  return run(async () => {
    const { orgId } = await assertClient();
    const input = DeviceGroupSchema.parse(raw);
    const group = await DeviceGroupService.create(orgId, input.name);
    refresh();
    return { id: group.id, name: group.name };
  });
}

export async function renameDeviceGroup(groupId: number, raw: DeviceGroupInput) {
  return run(async () => {
    const { orgId } = await assertClient();
    const input = DeviceGroupSchema.parse(raw);
    await DeviceGroupService.rename(orgId, groupId, input.name);
    refresh();
  });
}

export async function deleteDeviceGroup(groupId: number) {
  return run(async () => {
    const { orgId } = await assertClient();
    await DeviceGroupService.remove(orgId, groupId);
    refresh();
  });
}
