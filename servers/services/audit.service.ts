import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma";

export type AuditEntry = {
  actorId?: number | null;
  orgId?: number | null;
  action: string;
  targetType?: string;
  targetId?: string | number;
  metadata?: Prisma.InputJsonValue;
};

export const AuditService = {
  // Auditing must never break the action it describes, so a failure is only logged.
  async log(entry: AuditEntry) {
    try {
      await prisma.auditLog.create({
        data: {
          actorId: entry.actorId ?? null,
          orgId: entry.orgId ?? null,
          action: entry.action,
          targetType: entry.targetType,
          targetId: entry.targetId === undefined ? undefined : String(entry.targetId),
          metadata: entry.metadata,
        },
      });
    } catch (err) {
      console.error("audit log failed", err);
    }
  },

  async list(opts: { orgId?: number; take?: number } = {}) {
    return await prisma.auditLog.findMany({
      where: opts.orgId !== undefined ? { orgId: opts.orgId } : undefined,
      orderBy: { id: "desc" },
      take: opts.take ?? 200,
    });
  },
};
