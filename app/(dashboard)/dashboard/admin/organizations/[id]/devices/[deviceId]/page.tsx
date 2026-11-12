import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import DeviceDetail from "@/components/dashboard/devices/DeviceDetail";
import { resolveDateRange } from "@/lib/date-range";
import { OrganizationService } from "@/servers/services/organization.service";

type Props = {
  params: Promise<{ id: string; deviceId: string }>;
  searchParams: Promise<{ tab?: string; range?: string; from?: string; to?: string; iface?: string }>;
};

// The admin's view of a single device inside a client's fleet — same component as the client's own
// device page, just scoped by the org id in the URL (an admin has no orgId of their own). readOnly hides
// the quick actions (poll/test/pause/delete) and interface toggles, but the Settings tab still lets an
// admin update the device on the client's behalf.
export default async function AdminDevicePage({ params, searchParams }: Props) {
  await requireAdmin();
  const { id: rawOrgId, deviceId: rawId } = await params;
  const orgId = Number(rawOrgId);
  const id = Number(rawId);
  if (!Number.isInteger(orgId) || !Number.isInteger(id)) notFound();

  const org = await OrganizationService.getById(orgId);
  if (!org) notFound();

  const sp = await searchParams;

  return (
    <DeviceDetail
      orgId={orgId}
      id={id}
      tab={sp.tab}
      range={resolveDateRange(sp)}
      iface={sp.iface}
      basePath={`/dashboard/admin/organizations/${orgId}/devices`}
      readOnly
    />
  );
}
