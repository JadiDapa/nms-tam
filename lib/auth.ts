import { cache } from "react";
import { redirect } from "next/navigation";
import { auth, currentUser } from "@clerk/nextjs/server";
import type { User } from "@/generated/prisma";
import { AppError, forbidden } from "@/lib/errors";
import { UserService } from "@/servers/services/user.service";

// Roles that must have two-step verification switched on before they can use the dashboard.
export const MFA_REQUIRED_ROLES = ["ADMIN"];

// The signed-in person as our own record. The first time a Clerk account signs in, it is linked to the record an
// admin created for its (verified) email address. Nobody without such a record gets in: sign-up is invitation only.
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const { userId } = await auth();
  if (!userId) return null;

  const existing = await UserService.getByClerkId(userId);
  if (existing) return existing;

  const clerkUser = await currentUser();
  const email = clerkUser?.primaryEmailAddress;
  if (!email || email.verification?.status !== "verified") return null;

  return await UserService.linkClerk(email.emailAddress, userId, clerkUser?.fullName);
});

export const getSecurityStatus = cache(async () => {
  const clerkUser = await currentUser();
  return { twoFactorEnabled: clerkUser?.twoFactorEnabled ?? false };
});

// ---- for pages and layouts: send the visitor somewhere sensible ---------------------------------------------------

export async function requireUser(): Promise<User> {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const user = await getCurrentUser();
  if (!user) redirect("/not-invited");
  if (!user.active) redirect("/not-invited?reason=disabled");
  return user;
}

export async function requireAdmin(): Promise<User> {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect("/dashboard");
  return user;
}

export async function requireClient(): Promise<{ user: User; orgId: number }> {
  const user = await requireUser();
  if (user.role !== "USER" || user.orgId === null) redirect("/dashboard");
  return { user, orgId: user.orgId };
}

// ---- for server actions: refuse with an error instead of redirecting ---------------------------------------------
// Every server action is a public endpoint, so each one starts with one of these.

export async function assertUser(): Promise<User> {
  const { userId } = await auth();
  if (!userId) throw new AppError("Please sign in again.", 401);
  const user = await getCurrentUser();
  if (!user || !user.active) throw forbidden();
  return user;
}

export async function assertAdmin(): Promise<User> {
  const user = await assertUser();
  if (user.role !== "ADMIN") throw forbidden();
  return user;
}

export async function assertClient(): Promise<{ user: User; orgId: number }> {
  const user = await assertUser();
  if (user.role !== "USER" || user.orgId === null) throw forbidden();
  return { user, orgId: user.orgId };
}
