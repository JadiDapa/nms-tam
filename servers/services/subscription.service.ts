import { prisma } from "@/lib/prisma";
import { AppError, notFound } from "@/lib/errors";
import { formatDate } from "@/lib/format";
import { deviceLimit, isLive } from "../billing/pricing";

export type Entitlements = {
  orgId: number;
  live: boolean;
  // why the client cannot add or change things right now (null when live)
  reason: string | null;
  planName: string | null;
  status: "NONE" | "ACTIVE" | "EXPIRED" | "CANCELED";
  currentPeriodEnd: Date | null;
  // whole days until the paid period ends (negative once it ended); null without a subscription
  daysLeft: number | null;
  extraSlots: number;
  deviceLimit: number;
  userLimit: number;
  minPollIntervalSec: number;
};

export const SubscriptionService = {
  async getByOrg(orgId: number) {
    return await prisma.subscription.findUnique({
      where: { orgId },
      include: { plan: true },
    });
  },

  // The single source of truth for "what may this client do right now". Every create action asks this first.
  async getEntitlements(orgId: number, now = new Date()): Promise<Entitlements> {
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      include: { subscription: { include: { plan: true } } },
    });
    if (!org) throw notFound("Organization");

    const sub = org.subscription;
    if (!sub) {
      return {
        orgId, live: false, reason: "No subscription yet. Contact your administrator to activate a plan.",
        planName: null, status: "NONE", currentPeriodEnd: null, daysLeft: null, extraSlots: 0, deviceLimit: 0, userLimit: 0,
        minPollIntervalSec: 30,
      };
    }

    const live = isLive(
      { orgActive: org.status === "ACTIVE", status: sub.status, currentPeriodEnd: sub.currentPeriodEnd },
      now,
    );

    let reason: string | null = null;
    if (!live) {
      if (org.status !== "ACTIVE") reason = "This account is suspended. Contact your administrator.";
      else if (sub.status === "CANCELED") reason = "The subscription was canceled. Contact your administrator.";
      else reason = `The subscription expired on ${formatDate(sub.currentPeriodEnd)}. Renew to keep making changes.`;
    }

    return {
      orgId,
      live,
      reason,
      planName: sub.plan.name,
      status: sub.status === "ACTIVE" && !live && org.status === "ACTIVE" ? "EXPIRED" : sub.status,
      currentPeriodEnd: sub.currentPeriodEnd,
      daysLeft: Math.ceil((sub.currentPeriodEnd.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)),
      extraSlots: sub.extraSlots,
      deviceLimit: deviceLimit(sub.plan, sub.extraSlots),
      userLimit: sub.plan.maxUsers,
      minPollIntervalSec: sub.plan.minPollIntervalSec,
    };
  },

  async usage(orgId: number) {
    const [devices, users] = await Promise.all([
      prisma.device.count({ where: { orgId } }),
      prisma.user.count({ where: { orgId, active: true } }),
    ]);
    return { devices, users };
  },

  // Admin: switch plan. Refused when the client currently uses more than the new plan allows.
  async changePlan(orgId: number, planId: number) {
    const [sub, plan, usage] = await Promise.all([
      prisma.subscription.findUnique({ where: { orgId } }),
      prisma.plan.findUnique({ where: { id: planId } }),
      SubscriptionService.usage(orgId),
    ]);
    if (!sub) throw new AppError("This client has no subscription yet. Record an activation payment first.");
    if (!plan) throw notFound("Plan");

    const newDeviceLimit = deviceLimit(plan, sub.extraSlots);
    if (usage.devices > newDeviceLimit) {
      throw new AppError(
        `The client has ${usage.devices} devices but this plan allows ${newDeviceLimit}. Ask them to remove ${usage.devices - newDeviceLimit} first.`,
      );
    }
    if (usage.users > plan.maxUsers) {
      throw new AppError(`The client has ${usage.users} users but this plan allows ${plan.maxUsers}.`);
    }
    return await prisma.subscription.update({ where: { orgId }, data: { planId } });
  },

  // Admin: remove (or set) bought slots without a payment. Refused when devices would exceed the new limit.
  async setExtraSlots(orgId: number, extraSlots: number) {
    const [sub, usage] = await Promise.all([
      prisma.subscription.findUnique({ where: { orgId }, include: { plan: true } }),
      SubscriptionService.usage(orgId),
    ]);
    if (!sub) throw new AppError("This client has no subscription yet.");
    const newLimit = deviceLimit(sub.plan, extraSlots);
    if (usage.devices > newLimit) {
      throw new AppError(
        `The client has ${usage.devices} devices but the limit would become ${newLimit}. Ask them to remove ${usage.devices - newLimit} first.`,
      );
    }
    return await prisma.subscription.update({ where: { orgId }, data: { extraSlots } });
  },

  async cancel(orgId: number) {
    const sub = await prisma.subscription.findUnique({ where: { orgId } });
    if (!sub) throw new AppError("This client has no subscription.");
    return await prisma.subscription.update({ where: { orgId }, data: { status: "CANCELED" } });
  },

  // Worker: mark subscriptions whose paid period ended. (Access already stops at the exact time via isLive.)
  async markExpired(now = new Date()) {
    const r = await prisma.subscription.updateMany({
      where: { status: "ACTIVE", currentPeriodEnd: { lte: now } },
      data: { status: "EXPIRED" },
    });
    return r.count;
  },
};
