import { Plus } from "lucide-react";
import { requireClient } from "@/lib/auth";
import PageHeader from "@/components/dashboard/PageHeader";
import ChannelTable from "@/components/dashboard/channels/ChannelTable";
import ChannelDialog from "@/components/dashboard/channels/ChannelDialog";
import { Button } from "@/components/ui/button";
import { AlertConfigService } from "@/servers/services/alert-config.service";
import { SubscriptionService } from "@/servers/services/subscription.service";

export default async function ChannelsPage() {
  const { orgId } = await requireClient();
  const [channels, credentials, ent] = await Promise.all([
    AlertConfigService.listChannels(orgId),
    AlertConfigService.listCredentials(orgId),
    SubscriptionService.getEntitlements(orgId),
  ]);

  return (
    <main className="w-full space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <PageHeader title="Channels" subtitle="Where alerts are delivered: Telegram or a webhook. Email is not available yet." />
        {ent.live && (
          <ChannelDialog
            credentials={credentials}
            trigger={
              <Button>
                <Plus className="size-4" />
                New Channel
              </Button>
            }
          />
        )}
      </div>

      <div className="space-y-2">
        <ChannelTable
          canChange={ent.live}
          channels={channels.map((c) => ({
            id: c.id,
            label: c.label,
            type: c.type,
            target: c.target,
            credentialLabel: c.credentialLabel,
            enabled: c.enabled,
          }))}
        />
        {channels.length === 0 && (
          <p className="text-muted-foreground py-16 text-center text-sm">No channels yet.</p>
        )}
      </div>
    </main>
  );
}
