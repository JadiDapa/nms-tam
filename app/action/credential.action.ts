"use server";

import { revalidatePath } from "next/cache";
import { run } from "@/lib/action";
import { assertClient } from "@/lib/auth";
import type { CredentialInput } from "@/servers/validators/monitoring.validator";
import { AlertConfigService } from "@/servers/services/alert-config.service";

export async function createCredential(input: CredentialInput) {
  return run(async () => {
    const { user, orgId } = await assertClient();
    const id = await AlertConfigService.createCredential(user, orgId, input);
    revalidatePath("/dashboard/credentials");
    return id;
  });
}

// The stored secret can never be read back, only replaced.
export async function rotateCredential(credentialId: number, input: CredentialInput) {
  return run(async () => {
    const { user, orgId } = await assertClient();
    await AlertConfigService.rotateCredential(user, orgId, credentialId, input);
    revalidatePath("/dashboard/credentials");
  });
}

export async function deleteCredential(credentialId: number) {
  return run(async () => {
    const { user, orgId } = await assertClient();
    await AlertConfigService.deleteCredential(user, orgId, credentialId);
    revalidatePath("/dashboard/credentials");
  });
}
