import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import { CreatePlanDTO, UpdatePlanDTO } from "../validators/plan.validator";

// Once a client is on a plan, its price and limits are frozen: changing them would silently change what clients
// already pay for. Only presentation fields can still be edited; to change limits, create a new plan.
const FREE_FIELDS: (keyof UpdatePlanDTO)[] = ["name", "isActive", "sortOrder"];

export const PlanService = {
  async list(opts: { activeOnly?: boolean } = {}) {
    return await prisma.plan.findMany({
      where: opts.activeOnly ? { isActive: true } : undefined,
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      include: { _count: { select: { subscriptions: true } } },
    });
  },

  async getById(id: number) {
    return await prisma.plan.findUnique({ where: { id } });
  },

  async create(data: CreatePlanDTO) {
    return await prisma.plan.create({ data });
  },

  async update(id: number, data: UpdatePlanDTO) {
    const used = await prisma.subscription.count({ where: { planId: id } });
    if (used > 0) {
      const locked = Object.keys(data).filter(
        (k) => data[k as keyof UpdatePlanDTO] !== undefined && !FREE_FIELDS.includes(k as keyof UpdatePlanDTO),
      );
      if (locked.length > 0) {
        throw new AppError(
          "This plan has subscribers, so its price and limits are locked. Create a new plan instead.",
        );
      }
    }
    return await prisma.plan.update({ where: { id }, data });
  },

  async delete(id: number) {
    const used = await prisma.subscription.count({ where: { planId: id } });
    if (used > 0) throw new AppError("This plan has subscribers. Deactivate it instead of deleting it.");
    return await prisma.plan.delete({ where: { id } });
  },
};
