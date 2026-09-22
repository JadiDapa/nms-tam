import { redirect } from "next/navigation";
import { requireClient } from "@/lib/auth";
import PageHeader from "@/components/dashboard/PageHeader";
import AlertRuleForm from "@/components/dashboard/alerts/AlertRuleForm";
import { DeviceService } from "@/servers/services/device.service";
import { ResourceService } from "@/servers/services/resource.service";
import { SubscriptionService } from "@/servers/services/subscription.service";

export default async function NewAlertRulePage() {
  const { orgId } = await requireClient();
  const [ent, devices, channels] = await Promise.all([
    SubscriptionService.getEntitlements(orgId),
    DeviceService.listByOrg(orgId),
    ResourceService.listByOrg(orgId, "CHANNEL"),
  ]);
  if (!ent.live) redirect("/dashboard/billing");

  return (
    <main className="w-full space-y-6">
      <PageHeader title="New Alert Rule" subtitle="Choose what to watch and who to tell." />
      {devices.length === 0 ? (
        <p className="text-muted-foreground text-sm">Add a device first, then create rules for it.</p>
      ) : (
        <AlertRuleForm
          devices={devices.filter((d) => d.engineDeviceId).map((d) => ({ id: d.id, name: d.name }))}
          channels={channels.map((c) => ({ id: c.id, label: c.label }))}
        />
      )}
    </main>
  );
}
