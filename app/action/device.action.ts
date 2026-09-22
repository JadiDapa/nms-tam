"use server";

import { revalidatePath } from "next/cache";
import { run } from "@/lib/action";
import { assertClient } from "@/lib/auth";
import {
  type CreateDeviceInput,
  type TestDeviceInput,
  type UpdateDeviceInput,
} from "@/servers/validators/monitoring.validator";
import { DeviceMonitorService } from "@/servers/services/device-monitor.service";

const refresh = (deviceId?: number) => {
  revalidatePath("/dashboard/devices");
  revalidatePath("/dashboard");
  if (deviceId !== undefined) revalidatePath(`/dashboard/devices/${deviceId}`);
};

// "Does this really work?" Nothing is saved and no slot is used.
export async function testDevice(input: TestDeviceInput) {
  return run(async () => {
    const { orgId } = await assertClient();
    return await DeviceMonitorService.test(orgId, input);
  });
}

export async function createDevice(input: CreateDeviceInput) {
  return run(async () => {
    const { user, orgId } = await assertClient();
    const id = await DeviceMonitorService.create(user, orgId, input);
    refresh();
    return id;
  });
}

export async function updateDevice(deviceId: number, input: UpdateDeviceInput) {
  return run(async () => {
    const { user, orgId } = await assertClient();
    await DeviceMonitorService.update(user, orgId, deviceId, input);
    refresh(deviceId);
  });
}

export async function deleteDevice(deviceId: number) {
  return run(async () => {
    const { user, orgId } = await assertClient();
    await DeviceMonitorService.remove(user, orgId, deviceId);
    refresh();
    revalidatePath("/dashboard/alerts");
  });
}

export async function setDeviceEnabled(deviceId: number, enabled: boolean) {
  return run(async () => {
    const { user, orgId } = await assertClient();
    await DeviceMonitorService.setEnabled(user, orgId, deviceId, enabled);
    refresh(deviceId);
  });
}

export async function pollDeviceNow(deviceId: number) {
  return run(async () => {
    const { orgId } = await assertClient();
    const report = await DeviceMonitorService.pollNow(orgId, deviceId);
    refresh(deviceId);
    return report;
  });
}

export async function testStoredDevice(deviceId: number) {
  return run(async () => {
    const { orgId } = await assertClient();
    return await DeviceMonitorService.testStored(orgId, deviceId);
  });
}

export async function setInterfaceMonitored(deviceId: number, interfaceId: string, monitored: boolean) {
  return run(async () => {
    const { user, orgId } = await assertClient();
    await DeviceMonitorService.setInterfaceMonitored(user, orgId, deviceId, interfaceId, monitored);
    revalidatePath(`/dashboard/devices/${deviceId}`);
  });
}
