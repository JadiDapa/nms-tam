"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { SeverityBadge } from "./StatusBadge";
import { headerIconButton } from "./header-styles";

export type NotificationItem = {
  id: string;
  title: string;
  subtitle: string;
  href: string;
  severity?: string;
};

type Props = {
  count: number;
  items: NotificationItem[];
  footerHref: string;
  footerLabel: string;
  emptyText: string;
  loading?: boolean;
};

export default function NotificationsMenu({ count, items, footerHref, footerLabel, emptyText, loading }: Props) {
  if (loading) {
    return (
      <button type="button" aria-label="Notifications" disabled className={headerIconButton}>
        <Bell className="size-4.5" />
      </button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" aria-label={count > 0 ? `Notifications (${count})` : "Notifications"} title="Notifications" className={headerIconButton}>
          <Bell className="size-4.5" />
          {count > 0 && (
            <span className="bg-primary text-primary-foreground absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] leading-none font-semibold">
              {count > 99 ? "99+" : count}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="text-foreground px-3 py-2 text-sm font-semibold">Notifications</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {items.length === 0 ? (
          <p className="text-muted-foreground px-3 py-6 text-center text-sm">{emptyText}</p>
        ) : (
          items.map((item) => (
            <DropdownMenuItem key={item.id} asChild>
              <Link href={item.href} className="flex items-start justify-between gap-3">
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-foreground truncate text-sm font-medium">{item.title}</span>
                  <span className="text-muted-foreground truncate text-xs">{item.subtitle}</span>
                </span>
                {item.severity && <SeverityBadge severity={item.severity} />}
              </Link>
            </DropdownMenuItem>
          ))
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href={footerHref} className="justify-center text-sm font-medium">
            {footerLabel}
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
