import { requireClient } from "@/lib/auth";
import AlertRulesOverview from "@/components/dashboard/alerts/AlertRulesOverview";

type Props = {
  searchParams: Promise<{ show?: string }>;
};

export default async function AlertsPage({ searchParams }: Props) {
  const { orgId } = await requireClient();
  const { show } = await searchParams;
  return <AlertRulesOverview orgId={orgId} show={show} />;
}
