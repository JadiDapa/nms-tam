"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { LifeBuoy } from "lucide-react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { isActiveItem, menuFor } from "@/lib/sidebar-menu";
import { BrandMark } from "./BrandMark";
import GlobalSearch from "./GlobalSearch";
import MobileNav from "./MobileNav";
import UserMenu from "./UserMenu";
import { headerIconButton } from "./header-styles";
import type { ShellUser } from "./shell-types";

// Floating pills on the page background: brand · main sections · profile.
type Props = {
  user: ShellUser;
  orgName?: string | null;
  // Server-rendered bell (streams in on its own) and an optional support link from SUPPORT_URL.
  notifications: ReactNode;
  supportUrl?: string;
};

export default function DashboardNavbar({ user, orgName, notifications, supportUrl }: Props) {
  const pathname = usePathname();
  const { top } = menuFor(user.role);

  return (
    <header data-app-chrome className="bg-background/80 sticky top-0 z-40 backdrop-blur-md">
      <div className="mx-auto grid max-w-450 grid-cols-[1fr_auto] items-center gap-3 px-4 py-3 lg:grid-cols-[1fr_auto_1fr] lg:px-6">
        <div className="flex items-center gap-2">
          <MobileNav role={user.role} />
          <BrandMark compactOnMobile className="bg-card flex h-14 items-center gap-2.5 rounded-full py-2 pr-5 pl-2 shadow-xs max-sm:pr-2" />
        </div>

        <nav className="bg-card hidden h-14 auto-cols-fr grid-flow-col items-center gap-1 rounded-full p-2 shadow-xs lg:grid">
          {top.map((item) => (
            <Link
              key={item.url}
              href={item.url}
              className={cn(
                "flex h-10 items-center justify-center rounded-full px-5 text-sm font-medium whitespace-nowrap transition-colors",
                isActiveItem(pathname, item)
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {item.title}
            </Link>
          ))}
        </nav>

        <div className="flex items-center justify-end gap-2">
          <div className="bg-card flex h-14 items-center gap-1 rounded-full px-2 shadow-xs">
            <GlobalSearch role={user.role} />
            {notifications}
            {supportUrl && user.role === "USER" && (
              <a
                href={supportUrl}
                target="_blank"
                rel="noreferrer"
                aria-label="Customer support"
                title="Customer support"
                className={`${headerIconButton} max-sm:hidden`}
              >
                <LifeBuoy className="size-4.5" />
              </a>
            )}
          </div>
          <UserMenu user={user} orgName={orgName} />
        </div>
      </div>
    </header>
  );
}
