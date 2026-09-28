import { FlaskConical, TriangleAlert } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import PageHeader from "@/components/dashboard/PageHeader";
import SimulateForm from "@/components/dashboard/admin/SimulateForm";
import { SimulateService } from "@/servers/services/simulate.service";

export default async function SimulatePage() {
  await requireAdmin();
  const accounts = await SimulateService.listAccountsWithDevices();

  return (
    <main className="w-full max-w-6xl space-y-6">
      <div className="flex items-start gap-3">
        <span className="bg-muted border-border/60 flex size-10 shrink-0 items-center justify-center rounded-2xl border">
          <FlaskConical className="text-foreground/70 size-5" />
        </span>
        <PageHeader
          title="Simulate Historical Device Data"
          subtitle="Backfill interface traffic history for testing or demos."
        />
      </div>
      <p className="text-destructive bg-destructive/10 flex items-start gap-2 rounded-xl px-4 py-3 text-sm">
        <TriangleAlert className="mt-0.5 size-4 shrink-0" />
        This overwrites existing data at the generated timestamps and cannot be undone. Generated data is indistinguishable from real data afterward — use it only on demo or test accounts.
      </p>
      <SimulateForm accounts={accounts} />
    </main>
  );
}
