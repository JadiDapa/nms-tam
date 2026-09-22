import { prisma } from "@/lib/prisma";
import { AppError, notFound } from "@/lib/errors";
import { isLive, periodAfterPayment, receiptNumber } from "../billing/pricing";
import { RecordPaymentDTO } from "../validators/payment.validator";

export const PaymentService = {
  async list(opts: { orgId?: number } = {}) {
    return await prisma.payment.findMany({
      where: opts.orgId !== undefined ? { orgId: opts.orgId } : undefined,
      orderBy: { id: "desc" },
      include: { org: true, recordedBy: true },
    });
  },

  async getById(id: number) {
    return await prisma.payment.findUnique({
      where: { id },
      include: { org: true, recordedBy: true },
    });
  },

  // Records a payment AND applies what it paid for (activation, renewal, extra slots) in one transaction,
  // so a receipt can never exist without its effect, or the other way round.
  async record(input: RecordPaymentDTO, actorId: number) {
    const now = new Date();

    return await prisma.$transaction(async (tx) => {
      // serialise concurrent payments for the same client (receipt sequence and period arithmetic)
      await tx.$queryRaw`SELECT id FROM "Organization" WHERE id = ${input.orgId} FOR UPDATE`;

      const org = await tx.organization.findUnique({ where: { id: input.orgId } });
      if (!org) throw notFound("Organization");
      const sub = await tx.subscription.findUnique({ where: { orgId: input.orgId }, include: { plan: true } });

      let planId: number;
      let extraSlots: number;
      let coversFrom: Date | null = null;
      let coversUntil: Date | null = null;
      let subscriptionId: number;

      if (input.kind === "ACTIVATION") {
        if (sub && sub.status !== "CANCELED") {
          throw new AppError("This client already has a subscription. Record a renewal instead.");
        }
        const plan = await tx.plan.findUnique({ where: { id: input.planId! } });
        if (!plan) throw notFound("Plan");
        const period = periodAfterPayment(null, now, input.months);
        coversFrom = period.from;
        coversUntil = period.until;
        planId = plan.id;
        extraSlots = input.slots;
        const saved = sub
          ? await tx.subscription.update({
              where: { orgId: input.orgId },
              data: { planId, status: "ACTIVE", currentPeriodEnd: period.until, extraSlots },
            })
          : await tx.subscription.create({
              data: { orgId: input.orgId, planId, status: "ACTIVE", currentPeriodEnd: period.until, extraSlots },
            });
        subscriptionId = saved.id;
      } else {
        if (!sub) throw new AppError("This client has no subscription yet. Record an activation first.");
        if (sub.status === "CANCELED") throw new AppError("The subscription was canceled. Record an activation to restart it.");
        planId = sub.planId;
        subscriptionId = sub.id;
        extraSlots = sub.extraSlots;

        const data: { currentPeriodEnd?: Date; status?: "ACTIVE"; extraSlots?: number } = {};

        if (input.kind === "RENEWAL" || (input.kind === "ADJUSTMENT" && input.months > 0)) {
          const period = periodAfterPayment(sub.currentPeriodEnd, now, input.months);
          coversFrom = period.from;
          coversUntil = period.until;
          data.currentPeriodEnd = period.until;
          data.status = "ACTIVE";
        }
        if (input.kind === "EXTRA_SLOTS" || (input.kind === "ADJUSTMENT" && input.slots > 0)) {
          if (
            input.kind === "EXTRA_SLOTS" &&
            !isLive({ orgActive: org.status === "ACTIVE", status: sub.status, currentPeriodEnd: sub.currentPeriodEnd }, now)
          ) {
            throw new AppError("The subscription is not active. Record a renewal first, then add slots.");
          }
          extraSlots = sub.extraSlots + input.slots;
          data.extraSlots = extraSlots;
        }
        await tx.subscription.update({ where: { orgId: input.orgId }, data });
      }

      const plan = await tx.plan.findUniqueOrThrow({ where: { id: planId } });

      const year = now.getUTCFullYear();
      const seq = await tx.receiptSequence.upsert({
        where: { year },
        create: { year, last: 1 },
        update: { last: { increment: 1 } },
      });

      return await tx.payment.create({
        data: {
          receiptNumber: receiptNumber(year, seq.last),
          orgId: input.orgId,
          subscriptionId,
          kind: input.kind,
          amount: input.amount,
          method: input.method,
          paidAt: input.paidAt,
          months: input.months,
          coversFrom,
          coversUntil,
          reference: input.reference,
          evidenceUrl: input.evidenceUrl || null,
          note: input.note || null,
          planName: plan.name,
          planPrice: plan.priceMonthly,
          extraSlots,
          extraSlotPrice: plan.extraSlotPrice,
          recordedById: actorId,
        },
      });
    });
  },

  // Voiding only marks the receipt as cancelled. It does not undo the subscription change: an admin fixes that
  // explicitly (change slots, cancel, ...), so nothing is silently taken away from a client.
  async void(id: number, reason: string) {
    const p = await prisma.payment.findUnique({ where: { id } });
    if (!p) throw notFound("Payment");
    if (p.voidedAt) throw new AppError("This payment is already voided.");
    return await prisma.payment.update({ where: { id }, data: { voidedAt: new Date(), voidReason: reason } });
  },
};
