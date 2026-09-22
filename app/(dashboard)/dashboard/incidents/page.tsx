import { requireClient } from "@/lib/auth";
import IncidentsOverview, { type IncidentsQuery } from "@/components/dashboard/incidents/IncidentsOverview";

type Props = {
  searchParams: Promise<IncidentsQuery>;
};

export default async function IncidentsPage({ searchParams }: Props) {
  const { orgId } = await requireClient();
  return <IncidentsOverview orgId={orgId} query={await searchParams} />;
}
