import Link from "next/link";
import { cn } from "@/lib/utils";

type Tab = { key: string; label: string };

// Underlined tabs. Plain links (?tab=...), so the server page just renders the chosen one.
export default function DeviceTabs({ deviceId, tabs, current, incidents }: { deviceId: number; tabs: readonly Tab[]; current: string; incidents: number }) {
  return (
    <nav className="flex gap-1 overflow-x-auto border-b" aria-label="Device sections">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={`/dashboard/devices/${deviceId}?tab=${t.key}`}
          aria-current={t.key === current ? "page" : undefined}
          className={cn(
            "-mb-px flex shrink-0 items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
            t.key === current ? "border-primary text-foreground" : "text-muted-foreground hover:text-foreground border-transparent",
          )}
        >
          {t.label}
          {t.key === "incidents" && incidents > 0 && (
            <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] leading-none font-semibold text-white">{incidents}</span>
          )}
        </Link>
      ))}
    </nav>
  );
}
