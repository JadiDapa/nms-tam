"use server";

import { revalidatePath } from "next/cache";
import z from "zod";
import { run } from "@/lib/action";
import { assertAdmin } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import { CreateUserSchema, UpdateUserSchema } from "@/servers/validators/user.validator";
import { UserService } from "@/servers/services/user.service";
import { ClerkService } from "@/servers/services/clerk.service";
import { AuditService } from "@/servers/services/audit.service";
import { SubscriptionService } from "@/servers/services/subscription.service";

// Creates the person's record and emails them an invitation. Nobody can sign up without one.
export async function inviteUser(input: z.input<typeof CreateUserSchema>) {
  return run(async () => {
    const admin = await assertAdmin();
    const data = CreateUserSchema.parse(input);

    if (await UserService.getByEmail(data.email)) {
      throw new AppError("A user with this email already exists.");
    }
    if (data.orgId !== null) {
      const ent = await SubscriptionService.getEntitlements(data.orgId);
      const seats = await UserService.countByOrg(data.orgId);
      if (ent.status !== "NONE" && seats >= ent.userLimit) {
        throw new AppError(`This client's plan allows ${ent.userLimit} users and all seats are used.`);
      }
    }

    const user = await UserService.create(data);
    try {
      await ClerkService.invite(user.email);
    } catch (err) {
      console.error(err);
      await UserService.delete(user.id);
      throw new AppError("The invitation email could not be sent. Check the email address and try again.");
    }

    await AuditService.log({ actorId: admin.id, orgId: user.orgId, action: "user.invite", targetType: "User", targetId: user.id, metadata: { email: user.email, role: user.role } });
    revalidatePath("/dashboard/admin/users");
    revalidatePath("/dashboard/admin/organizations");
  });
}

export async function resendInvitation(userId: number) {
  return run(async () => {
    const admin = await assertAdmin();
    const user = await UserService.getById(userId);
    if (!user || user.clerkId) throw new AppError("This person already has an account.");
    await ClerkService.invite(user.email);
    await AuditService.log({ actorId: admin.id, orgId: user.orgId, action: "user.reinvite", targetType: "User", targetId: user.id });
  });
}

export async function updateUser(userId: number, input: z.input<typeof UpdateUserSchema>) {
  return run(async () => {
    const admin = await assertAdmin();
    const data = UpdateUserSchema.parse(input);
    const user = await UserService.getById(userId);
    if (!user) throw new AppError("User not found", 404);
    if (data.active === false && user.id === admin.id) throw new AppError("You cannot deactivate your own account.");

    await UserService.update(userId, data);
    if (data.active !== undefined && user.clerkId) {
      if (data.active) await ClerkService.unban(user.clerkId);
      else await ClerkService.ban(user.clerkId);
    }
    await AuditService.log({ actorId: admin.id, orgId: user.orgId, action: "user.update", targetType: "User", targetId: userId, metadata: data });
    revalidatePath("/dashboard/admin/users");
    revalidatePath("/dashboard/admin/organizations");
  });
}

// Only a person who never signed up can be removed; everyone else is deactivated (their history stays).
export async function deletePendingUser(userId: number) {
  return run(async () => {
    const admin = await assertAdmin();
    const user = await UserService.getById(userId);
    if (!user) throw new AppError("User not found", 404);
    if (user.clerkId) throw new AppError("This person has an account. Deactivate them instead.");
    await UserService.delete(userId);
    await AuditService.log({ actorId: admin.id, orgId: user.orgId, action: "user.delete", targetType: "User", targetId: userId });
    revalidatePath("/dashboard/admin/users");
  });
}
