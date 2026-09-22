import { Plus } from "lucide-react";
import { requireClient } from "@/lib/auth";
import PageHeader from "@/components/dashboard/PageHeader";
import CredentialTable from "@/components/dashboard/credentials/CredentialTable";
import CredentialDialog from "@/components/dashboard/credentials/CredentialDialog";
import { Button } from "@/components/ui/button";
import { AlertConfigService } from "@/servers/services/alert-config.service";
import { SubscriptionService } from "@/servers/services/subscription.service";

export default async function CredentialsPage() {
  const { orgId } = await requireClient();
  const [credentials, ent] = await Promise.all([
    AlertConfigService.listCredentials(orgId),
    SubscriptionService.getEntitlements(orgId),
  ]);

  return (
    <main className="w-full space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <PageHeader
          title="Credentials"
          subtitle="SNMP logins and bot tokens. They are encrypted and can never be shown again, only replaced."
        />
        {ent.live && (
          <CredentialDialog
            trigger={
              <Button>
                <Plus className="size-4" />
                New Credential
              </Button>
            }
          />
        )}
      </div>

      <div className="space-y-2">
        <CredentialTable credentials={credentials} canChange={ent.live} />
        {credentials.length === 0 && (
          <p className="text-muted-foreground py-16 text-center text-sm">No credentials yet.</p>
        )}
      </div>
    </main>
  );
}
