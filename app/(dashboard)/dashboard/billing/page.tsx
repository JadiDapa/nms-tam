import { requireClient } from "@/lib/auth";
import BillingOverview from "@/components/dashboard/billing/BillingOverview";

export default async function BillingPage() {
  const { orgId } = await requireClient();
  return <BillingOverview orgId={orgId} />;
}
