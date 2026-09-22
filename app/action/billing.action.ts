"use server";

import { revalidatePath } from "next/cache";
import z from "zod";
import { run } from "@/lib/action";
import { assertAdmin, assertClient } from "@/lib/auth";
import { AppError } from "@/lib/errors";
import {
  RecordPaymentSchema,
  VoidPaymentSchema,
} from "@/servers/validators/payment.validator";
import {
  CreateBillingRequestSchema,
  ResolveBillingRequestSchema,
} from "@/servers/validators/billing-request.validator";
import { PaymentService } from "@/servers/services/payment.service";
import { SubscriptionService } from "@/servers/services/subscription.service";
import { BillingRequestService } from "@/servers/services/billing-request.service";
import { DeviceMonitorService } from "@/servers/services/device-monitor.service";
import { AuditService } from "@/servers/services/audit.service";

const refresh = (orgId: number) => {
  revalidatePath("/dashboard/admin/organizations");
  revalidatePath(`/dashboard/admin/organizations/${orgId}`);
  revalidatePath("/dashboard/admin/payments");
  revalidatePath("/dashboard/billing");
  revalidatePath("/dashboard", "layout");
};

// ---- admin ---------------------------------------------------------------------------------------------------------

export async function recordPayment(input: z.input<typeof RecordPaymentSchema>) {
  return run(async () => {
    const admin = await assertAdmin();
    const data = RecordPaymentSchema.parse(input);
    const payment = await PaymentService.record(data, admin.id);
    // a renewal brings paused devices back; the result of that sync is not part of the payment itself
    const synced = await DeviceMonitorService.syncOrgDevices(data.orgId);
    await AuditService.log({
      actorId: admin.id, orgId: data.orgId, action: "payment.record", targetType: "Payment", targetId: payment.id,
      metadata: { receipt: payment.receiptNumber, kind: data.kind, amount: data.amount },
    });
    refresh(data.orgId);
    return { id: payment.id, receiptNumber: payment.receiptNumber, devicesResumed: synced.changed, syncFailed: synced.failed };
  });
}

export async function voidPayment(paymentId: number, input: z.input<typeof VoidPaymentSchema>) {
  return run(async () => {
    const admin = await assertAdmin();
    const { reason } = VoidPaymentSchema.parse(input);
    const payment = await PaymentService.void(paymentId, reason);
    await AuditService.log({ actorId: admin.id, orgId: payment.orgId, action: "payment.void", targetType: "Payment", targetId: paymentId, metadata: { reason } });
    refresh(payment.orgId);
  });
}

export async function changePlan(orgId: number, planId: number) {
  return run(async () => {
    const admin = await assertAdmin();
    await SubscriptionService.changePlan(orgId, planId);
    await AuditService.log({ actorId: admin.id, orgId, action: "subscription.change_plan", targetType: "Subscription", metadata: { planId } });
    refresh(orgId);
  });
}

export async function setExtraSlots(orgId: number, extraSlots: number) {
  return run(async () => {
    const admin = await assertAdmin();
    if (!Number.isInteger(extraSlots) || extraSlots < 0 || extraSlots > 10_000) {
      throw new AppError("Enter a whole number of slots (0 or more).");
    }
    await SubscriptionService.setExtraSlots(orgId, extraSlots);
    await AuditService.log({ actorId: admin.id, orgId, action: "subscription.set_slots", targetType: "Subscription", metadata: { extraSlots } });
    refresh(orgId);
  });
}

export async function cancelSubscription(orgId: number) {
  return run(async () => {
    const admin = await assertAdmin();
    await SubscriptionService.cancel(orgId);
    await DeviceMonitorService.syncOrgDevices(orgId);
    await AuditService.log({ actorId: admin.id, orgId, action: "subscription.cancel", targetType: "Subscription" });
    refresh(orgId);
  });
}

export async function resolveBillingRequest(requestId: number, input: z.input<typeof ResolveBillingRequestSchema>) {
  return run(async () => {
    const admin = await assertAdmin();
    const data = ResolveBillingRequestSchema.parse(input);
    const r = await BillingRequestService.resolve(requestId, data.status, data.adminNote);
    await AuditService.log({ actorId: admin.id, orgId: r.orgId, action: "request.resolve", targetType: "BillingRequest", targetId: requestId, metadata: { status: data.status } });
    revalidatePath("/dashboard/admin/requests");
    revalidatePath("/dashboard/billing");
  });
}

// ---- client --------------------------------------------------------------------------------------------------------

export async function createBillingRequest(input: z.input<typeof CreateBillingRequestSchema>) {
  return run(async () => {
    const { user, orgId } = await assertClient();
    const data = CreateBillingRequestSchema.parse(input);
    await BillingRequestService.create(orgId, user.id, data);
    await AuditService.log({ actorId: user.id, orgId, action: "request.create", targetType: "BillingRequest", metadata: { kind: data.kind } });
    revalidatePath("/dashboard/billing");
    revalidatePath("/dashboard/admin/requests");
  });
}
