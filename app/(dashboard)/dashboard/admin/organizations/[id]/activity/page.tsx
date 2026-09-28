import { requireAdmin } from "@/lib/auth";
import { formatDate, timeAgo } from "@/lib/format";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { AuditService } from "@/servers/services/audit.service";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function OrganizationActivityPage({ params }: Props) {
  await requireAdmin();
  const id = Number((await params).id);
  const audit = await AuditService.list({ orgId: id, take: 100 });

  return (
    <div className="space-y-3">
      <ul className="bg-card divide-y rounded-lg border text-sm">
        {audit.map((a) => (
          <li key={a.id} className="flex items-center justify-between gap-4 px-4 py-2.5">
            <StatusBadge label={a.action} tone="blue" />
            <span className="text-muted-foreground text-xs whitespace-nowrap">
              {formatDate(a.createdAt)} · {timeAgo(a.createdAt)}
            </span>
          </li>
        ))}
        {audit.length === 0 && <li className="text-muted-foreground px-4 py-8 text-center">Nothing yet.</li>}
      </ul>
    </div>
  );
}
