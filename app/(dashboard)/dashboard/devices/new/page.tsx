import { redirect } from "next/navigation";
import { requireClient } from "@/lib/auth";
import PageHeader from "@/components/dashboard/PageHeader";
import DeviceWizard from "@/components/dashboard/devices/DeviceWizard";
import { SubscriptionService } from "@/servers/services/subscription.service";
import { DeviceService } from "@/servers/services/device.service";
import { DeviceGroupService } from "@/servers/services/device-group.service";

type Props = {
  // set by the "Add device" button on a group's own section, so the wizard opens with that group preselected
  searchParams: Promise<{ group?: string }>;
};

export default async function NewDevicePage({ searchParams }: Props) {
  const { orgId } = await requireClient();
  const { group } = await searchParams;
  const [ent, used, groups] = await Promise.all([
    SubscriptionService.getEntitlements(orgId),
    DeviceService.count(orgId),
    DeviceGroupService.listByOrg(orgId),
  ]);

  // cannot add: send them to billing, which explains why
  if (!ent.live || used >= ent.deviceLimit) redirect("/dashboard/billing");

  const defaultGroupId = group ? groups.find((g) => g.id === Number(group))?.id : undefined;

  return (
    <main className="w-full space-y-6">
      <PageHeader title="Add Device" subtitle="Test it for real, then save it." />
      <DeviceWizard
        groups={groups.map((g) => ({ id: g.id, name: g.name }))}
        defaultGroupId={defaultGroupId}
        minPollIntervalSec={ent.minPollIntervalSec}
        used={used}
        limit={ent.deviceLimit}
      />
    </main>
  );
}
