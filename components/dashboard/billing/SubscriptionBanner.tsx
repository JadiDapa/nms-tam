import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import type { Entitlements } from "@/servers/services/subscription.service";
import { formatDate } from "@/lib/format";

const bannerBase = "flex items-center gap-3 rounded-2xl px-5 py-3 text-sm";
const bannerLink = "ml-auto shrink-0 font-medium underline underline-offset-4";

// A client always knows where their subscription stands: a red bar when it is not active, an amber one close to expiry.
export default function SubscriptionBanner({ entitlements }: { entitlements: Entitlements }) {
  if (!entitlements.live) {
    return (
      <div className={`${bannerBase} bg-destructive/10 text-destructive dark:text-red-400`}>
        <AlertTriangle className="size-4 shrink-0" />
        <span>{entitlements.reason}</span>
        <Link href="/dashboard/billing" className={bannerLink}>
          Billing
        </Link>
      </div>
    );
  }

  const { daysLeft } = entitlements;
  if (daysLeft === null || daysLeft > 7) return null;

  return (
    <div className={`${bannerBase} bg-yellow-500/10 text-yellow-700 dark:text-yellow-500`}>
      <AlertTriangle className="size-4 shrink-0" />
      <span>
        Your subscription ends on {formatDate(entitlements.currentPeriodEnd)} ({daysLeft} day{daysLeft === 1 ? "" : "s"}
        ). Request a renewal to avoid interruption.
      </span>
      <Link href="/dashboard/billing" className={bannerLink}>
        Billing
      </Link>
    </div>
  );
}
