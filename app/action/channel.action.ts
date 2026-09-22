"use server";

import { revalidatePath } from "next/cache";
import { run } from "@/lib/action";
import { assertClient } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import type { ChannelInput } from "@/servers/validators/monitoring.validator";
import { AlertConfigService } from "@/servers/services/alert-config.service";

export async function createChannel(input: ChannelInput) {
  return run(async () => {
    const { user, orgId } = await assertClient();
    const id = await AlertConfigService.createChannel(user, orgId, input);
    revalidatePath("/dashboard/channels");
    return id;
  });
}

export async function setChannelEnabled(channelId: number, enabled: boolean) {
  return run(async () => {
    const { user, orgId } = await assertClient();
    await AlertConfigService.setChannelEnabled(user, orgId, channelId, enabled);
    revalidatePath("/dashboard/channels");
  });
}

// Sends a real message and reports what really happened.
export async function testChannel(channelId: number) {
  return run(async () => {
    const { orgId } = await assertClient();
    const r = await AlertConfigService.testChannel(orgId, channelId);
    if (!r.delivered) {
      throw new AppError(`The test message was not delivered: ${r.outcome.error ?? r.outcome.message ?? r.outcome.kind}`);
    }
  });
}

export async function deleteChannel(channelId: number) {
  return run(async () => {
    const { user, orgId } = await assertClient();
    await AlertConfigService.deleteChannel(user, orgId, channelId);
    revalidatePath("/dashboard/channels");
    revalidatePath("/dashboard/alerts");
  });
}
