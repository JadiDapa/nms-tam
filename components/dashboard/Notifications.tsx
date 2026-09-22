import NotificationsMenu from "./NotificationsMenu";
import { timeAgo } from "@/lib/format";
import { BillingRequestService } from "@/servers/services/billing-request.service";
import { IncidentService } from "@/servers/services/incident.service";

// What needs attention: a client sees their active incidents, an admin sees open billing requests.
// Loaded behind a Suspense boundary so a slow engine never delays the page.
export default async function Notifications({ role, orgId }: { role: string; orgId: number | null }) {
  if (role === "ADMIN") {
    const count = await BillingRequestService.countOpen();
    return (
      <NotificationsMenu
        count={count}
        items={
          count > 0
            ? [
                {
                  id: "requests",
                  title: `${count} open billing request${count === 1 ? "" : "s"}`,
                  subtitle: "Waiting for you to apply or decline",
                  href: "/dashboard/admin/requests",
                },
              ]
            : []
        }
        footerHref="/dashboard/admin/requests"
        footerLabel="View requests"
        emptyText="Nothing needs your attention."
      />
    );
  }

  const incidents =
    orgId === null
      ? { items: [], total: 0 }
      : await IncidentService.list(orgId, { status: "ACTIVE" }).catch(() => ({ items: [], total: 0 }));

  return (
    <NotificationsMenu
      count={incidents.total}
      items={incidents.items.slice(0, 5).map(({ incident, device }) => ({
        id: incident.id,
        title: incident.title,
        subtitle: `${device?.name ?? "removed device"} · ${timeAgo(incident.triggeredAt)}`,
        href: `/dashboard/incidents/${incident.id}`,
        severity: incident.severity,
      }))}
      footerHref="/dashboard/incidents"
      footerLabel="View all incidents"
      emptyText="No active incidents."
    />
  );
}
