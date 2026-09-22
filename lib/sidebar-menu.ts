import {
  Activity,
  BellRing,
  Building2,
  CreditCard,
  Inbox,
  KeyRound,
  LayoutDashboard,
  Layers,
  LucideIcon,
  Receipt,
  ScrollText,
  Send,
  Server,
  Siren,
  Settings,
  Users,
} from "lucide-react";

export type MenuItem = {
  title: string;
  url: string;
  icon: LucideIcon;
  roles?: string[];
  // "top" = text item in the top bar (main sections); "rail" = icon in the left rail (secondary pages);
  // "hidden" = not in either (reached from another page), but still in the mobile menu and the search.
  placement?: "top" | "rail" | "hidden";
  // other paths that count as "being in this section", so its menu item stays highlighted there
  alsoMatch?: string[];
};

export const overviewItems: MenuItem[] = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },

  // client
  { title: "Devices", url: "/dashboard/devices", icon: Server, roles: ["USER"] },
  { title: "Incidents", url: "/dashboard/incidents", icon: Siren, roles: ["USER"], alsoMatch: ["/dashboard/alerts"] },
  { title: "Alert Rules", url: "/dashboard/alerts", icon: BellRing, roles: ["USER"], placement: "hidden" },
  { title: "Channels", url: "/dashboard/channels", icon: Send, roles: ["USER"], placement: "rail" },
  { title: "Credentials", url: "/dashboard/credentials", icon: KeyRound, roles: ["USER"], placement: "rail" },
  { title: "Team", url: "/dashboard/team", icon: Users, roles: ["USER"], placement: "rail" },
  { title: "Billing", url: "/dashboard/billing", icon: CreditCard, roles: ["USER"] },

  // admin
  { title: "Clients", url: "/dashboard/admin/organizations", icon: Building2, roles: ["ADMIN"] },
  { title: "Plans", url: "/dashboard/admin/plans", icon: Layers, roles: ["ADMIN"] },
  { title: "Payments", url: "/dashboard/admin/payments", icon: Receipt, roles: ["ADMIN"] },
  { title: "Requests", url: "/dashboard/admin/requests", icon: Inbox, roles: ["ADMIN"] },
  { title: "Users", url: "/dashboard/admin/users", icon: Users, roles: ["ADMIN"], placement: "rail" },
  { title: "Engine", url: "/dashboard/admin/engine", icon: Activity, roles: ["ADMIN"], placement: "rail" },
  { title: "Audit Log", url: "/dashboard/admin/audit", icon: ScrollText, roles: ["ADMIN"], placement: "rail" },
];

export const settingsItems: MenuItem[] = [
  { title: "Settings", url: "/dashboard/profile", icon: Settings },
];

export function menuFor(role: string) {
  const items = filterMenuByRole(overviewItems, role);
  return {
    all: items,
    top: items.filter((i) => !i.placement || i.placement === "top"),
    rail: items.filter((i) => i.placement === "rail"),
  };
}

export function filterMenuByRole(items: MenuItem[], role: string): MenuItem[] {
  return items.filter((item) => !item.roles || item.roles.includes(role));
}

// "/dashboard" only matches itself; every other item also matches its sub pages.
export function isActiveUrl(pathname: string, url: string) {
  return url === "/dashboard" ? pathname === url : pathname === url || pathname.startsWith(url + "/");
}

// The menu item is highlighted on its own pages and on the pages of the sections that hang under it.
export function isActiveItem(pathname: string, item: Pick<MenuItem, "url" | "alsoMatch">) {
  return isActiveUrl(pathname, item.url) || (item.alsoMatch ?? []).some((u) => isActiveUrl(pathname, u));
}
