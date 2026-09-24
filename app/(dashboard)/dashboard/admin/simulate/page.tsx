import { requireAdmin } from "@/lib/auth";
import PageHeader from "@/components/dashboard/PageHeader";
import SimulateForm from "@/components/dashboard/admin/SimulateForm";
import { SimulateService } from "@/servers/services/simulate.service";

export default async function SimulatePage() {
  await requireAdmin();
  const devices = await SimulateService.listAllDevices();

  return (
    <main className="w-full max-w-2xl space-y-6">
      <PageHeader
        title="Simulate Historical Device Data"
        subtitle="Backfill metric history and alerts for testing or demos. This overwrites existing data in the chosen window and cannot be undone."
      />
      <SimulateForm devices={devices} />
    </main>
  );
}
