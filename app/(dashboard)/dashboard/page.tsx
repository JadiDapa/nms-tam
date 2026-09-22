import { requireUser } from "@/lib/auth";
import AdminOverview from "@/components/dashboard/dashboard/AdminOverview";
import ClientOverview from "@/components/dashboard/dashboard/ClientOverview";

export default async function DashboardPage() {
  const user = await requireUser();

  if (user.role === "ADMIN") return <AdminOverview />;
  if (user.orgId === null) return null;
  return <ClientOverview orgId={user.orgId} />;
}
