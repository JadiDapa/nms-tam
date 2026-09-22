import { prisma } from "@/lib/prisma";
import { AppError, notFound } from "@/lib/errors";
import { CreateBillingRequestDTO } from "../validators/billing-request.validator";

export const BillingRequestService = {
  async list(opts: { orgId?: number; status?: "OPEN" | "DONE" | "REJECTED" } = {}) {
    return await prisma.billingRequest.findMany({
      where: { orgId: opts.orgId, status: opts.status },
      orderBy: { id: "desc" },
      include: { org: true, requestedBy: true },
    });
  },

  async countOpen() {
    return await prisma.billingRequest.count({ where: { status: "OPEN" } });
  },

  async create(orgId: number, requestedById: number, data: CreateBillingRequestDTO) {
    const open = await prisma.billingRequest.count({ where: { orgId, status: "OPEN", kind: data.kind } });
    if (open >= 3) throw new AppError("You already have open requests of this kind. Please wait for them to be handled.");
    return await prisma.billingRequest.create({ data: { orgId, requestedById, ...data } });
  },

  async resolve(id: number, status: "DONE" | "REJECTED", adminNote?: string) {
    const r = await prisma.billingRequest.findUnique({ where: { id } });
    if (!r) throw notFound("Request");
    if (r.status !== "OPEN") throw new AppError("This request was already handled.");
    return await prisma.billingRequest.update({
      where: { id },
      data: { status, adminNote: adminNote || null, resolvedAt: new Date() },
    });
  },
};
