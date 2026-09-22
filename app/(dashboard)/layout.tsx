import { ReactNode, Suspense } from "react";
import DashboardRail from "@/components/dashboard/DashboardRail";
import DashboardNavbar from "@/components/dashboard/DashboardNavbar";
import Notifications from "@/components/dashboard/Notifications";
import NotificationsMenu from "@/components/dashboard/NotificationsMenu";
import MfaSetup from "@/components/auth/MfaSetup";
import SubscriptionBanner from "@/components/dashboard/billing/SubscriptionBanner";
import { getSecurityStatus, MFA_REQUIRED_ROLES, requireUser } from "@/lib/auth";
import { config } from "@/lib/config";
import { prisma } from "@/lib/prisma";
import { SubscriptionService } from "@/servers/services/subscription.service";

type Props = {
  children: ReactNode;
};

export default async function DashboardLayout({ children }: Props) {
  const user = await requireUser();

  // Staff accounts must have two-step verification switched on before they can use anything.
  if (config.requireAdminMfa && MFA_REQUIRED_ROLES.includes(user.role)) {
    const { twoFactorEnabled } = await getSecurityStatus();
    if (!twoFactorEnabled) return <MfaSetup />;
  }

  const org = user.orgId
    ? await prisma.organization.findUnique({ where: { id: user.orgId } })
    : null;
  const entitlements = user.orgId
    ? await SubscriptionService.getEntitlements(user.orgId)
    : null;

  return (
    <div className="bg-background min-h-screen">
      <DashboardNavbar
        user={{ name: user.name, email: user.email, role: user.role }}
        orgName={org?.name}
        supportUrl={config.supportUrl || undefined}
        notifications={
          <Suspense
            fallback={<NotificationsMenu loading count={0} items={[]} footerHref="" footerLabel="" emptyText="" />}
          >
            <Notifications role={user.role} orgId={user.orgId} />
          </Suspense>
        }
      />

      <div className="mx-auto flex max-w-450 items-start gap-4 px-4 pt-4 pb-8 lg:px-6">
        <DashboardRail role={user.role} />

        <main className="flex min-w-0 flex-1 flex-col gap-6">
          {entitlements && <SubscriptionBanner entitlements={entitlements} />}
          {children}
        </main>
      </div>
    </div>
  );
}
