"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { key: "", label: "Overview" },
  { key: "devices", label: "Devices" },
  { key: "billing", label: "Billing" },
  { key: "activity", label: "Activity" },
] as const;

// Underlined tabs across a client's own route tree (real pages, not a ?tab= param), same look as DeviceTabs.
export default function OrganizationTabs({ orgId, openRequests }: { orgId: number; openRequests: number }) {
  const pathname = usePathname();
  const base = `/dashboard/admin/organizations/${orgId}`;

  return (
    <nav className="flex gap-1 overflow-x-auto border-b" aria-label="Client sections">
      {TABS.map((t) => {
        const href = t.key ? `${base}/${t.key}` : base;
        const current = pathname === href;
        return (
          <Link
            key={t.key}
            href={href}
            aria-current={current ? "page" : undefined}
            className={cn(
              "-mb-px flex shrink-0 items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
              current ? "border-primary text-foreground" : "text-muted-foreground hover:text-foreground border-transparent",
            )}
          >
            {t.label}
            {t.key === "billing" && openRequests > 0 && (
              <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] leading-none font-semibold text-white">
                {openRequests}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
