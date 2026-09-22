import { redirect } from "next/navigation";
import { requireClient } from "@/lib/auth";
import PageHeader from "@/components/dashboard/PageHeader";
import DeviceWizard from "@/components/dashboard/devices/DeviceWizard";
import { AlertConfigService } from "@/servers/services/alert-config.service";
import { SubscriptionService } from "@/servers/services/subscription.service";
import { DeviceService } from "@/servers/services/device.service";

export default async function NewDevicePage() {
  const { orgId } = await requireClient();
  const [ent, credentials, used] = await Promise.all([
    SubscriptionService.getEntitlements(orgId),
    AlertConfigService.listCredentials(orgId),
    DeviceService.count(orgId),
  ]);

  // cannot add: send them to billing, which explains why
  if (!ent.live || used >= ent.deviceLimit) redirect("/dashboard/billing");

  return (
    <main className="w-full space-y-6">
      <PageHeader title="Add Device" subtitle="Test it for real, then save it." />
      <DeviceWizard
        credentials={credentials.filter((c) => c.type.startsWith("snmp_")).map((c) => ({ id: c.id, label: c.label, type: c.type }))}
        minPollIntervalSec={ent.minPollIntervalSec}
        used={used}
        limit={ent.deviceLimit}
      />
    </main>
  );
}
