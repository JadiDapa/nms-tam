import { requireClient } from "@/lib/auth";
import BillingOverview from "@/components/dashboard/billing/BillingOverview";

type Props = {
  searchParams: Promise<{ range?: string; from?: string; to?: string }>;
};

export default async function BillingPage({ searchParams }: Props) {
  const { orgId } = await requireClient();
  return <BillingOverview orgId={orgId} query={await searchParams} />;
}
