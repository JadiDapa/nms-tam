import { Activity, CalendarDays, ListTree, UserCog } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { formatDateTime, timeAgo } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import PageHeader from "@/components/dashboard/PageHeader";
import { StatCard, StatGroup } from "@/components/dashboard/StatCard";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { AuditService } from "@/servers/services/audit.service";

export default async function AuditPage() {
  await requireAdmin();
  const entries = await AuditService.list({ take: 300 });

  const actorIds = [...new Set(entries.map((e) => e.actorId).filter((x): x is number => x !== null))];
  const orgIds = [...new Set(entries.map((e) => e.orgId).filter((x): x is number => x !== null))];
  const [actors, orgs] = await Promise.all([
    prisma.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true, email: true } }),
    prisma.organization.findMany({ where: { id: { in: orgIds } }, select: { id: true, name: true } }),
  ]);
  const actorName = (id: number | null) => {
    const a = actors.find((x) => x.id === id);
    return a ? (a.name ?? a.email) : "system";
  };
  const orgName = (id: number | null) => orgs.find((x) => x.id === id)?.name ?? "";

  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const today = entries.filter((e) => e.createdAt >= dayStart).length;

  return (
    <main className="w-full space-y-6">
      <PageHeader title="Audit Log" subtitle="Who changed what. The latest 300 entries." />

      <StatGroup className="lg:grid-cols-4">
        <StatCard label="Entries shown" value={entries.length} icon={ListTree} featured caption="latest 300" />
        <StatCard label="Today" value={today} icon={CalendarDays} caption="actions since midnight" />
        <StatCard label="Distinct actors" value={actorIds.length} icon={UserCog} caption="staff who made a change" />
        <StatCard
          label="Most recent"
          value={entries[0] ? timeAgo(entries[0].createdAt) : "—"}
          icon={Activity}
          caption={entries[0] ? entries[0].action : "no activity yet"}
        />
      </StatGroup>

      <div className="bg-card rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="ps-5">WHEN</TableHead>
              <TableHead>WHO</TableHead>
              <TableHead>CLIENT</TableHead>
              <TableHead>ACTION</TableHead>
              <TableHead>DETAILS</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((e) => (
              <TableRow key={e.id}>
                <TableCell className="text-muted-foreground ps-5 text-xs whitespace-nowrap">{formatDateTime(e.createdAt)}</TableCell>
                <TableCell className="text-sm">{actorName(e.actorId)}</TableCell>
                <TableCell className="text-sm">{orgName(e.orgId) || <span className="text-muted-foreground">—</span>}</TableCell>
                <TableCell>
                  <StatusBadge label={e.action} tone="blue" />
                </TableCell>
                <TableCell className="text-muted-foreground max-w-md truncate text-xs">
                  {e.targetType ? `${e.targetType} ${e.targetId ?? ""}` : ""} {e.metadata ? JSON.stringify(e.metadata) : ""}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {entries.length === 0 && <p className="text-muted-foreground py-16 text-center text-sm">Nothing recorded yet.</p>}
      </div>
    </main>
  );
}
