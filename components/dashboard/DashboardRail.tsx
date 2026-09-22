"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useClerk } from "@clerk/nextjs";
import { useTheme } from "next-themes";
import { LogOut, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import { isActiveItem, menuFor, settingsItems } from "@/lib/sidebar-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const pill = "bg-card flex flex-col items-center gap-1 rounded-full p-1.5 shadow-xs";
const railButton = "flex size-10 items-center justify-center rounded-full transition-colors";

function RailTip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="right" sideOffset={10}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

// Icon rail (desktop only): theme switch · secondary pages, with the page menu centred between them and settings + sign out pinned to the bottom.
export default function DashboardRail({ role }: { role: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const { signOut } = useClerk();
  const { setTheme } = useTheme();
  const { rail } = menuFor(role);

  const handleSignOut = async () => {
    await signOut();
    router.replace("/sign-in");
  };

  return (
    <TooltipProvider>
      <aside data-app-chrome className="sticky top-24 hidden h-[calc(100dvh-7.5rem)] shrink-0 flex-col gap-3 self-start lg:flex">
        {/* The active side follows the html "dark" class, so no client-only state is needed. */}
        <div className={pill}>
          <button
            type="button"
            aria-label="Light theme"
            onClick={() => setTheme("light")}
            className={cn(railButton, "bg-foreground text-background dark:bg-transparent dark:text-muted-foreground")}
          >
            <Sun className="size-4.5" />
          </button>
          <button
            type="button"
            aria-label="Dark theme"
            onClick={() => setTheme("dark")}
            className={cn(railButton, "text-muted-foreground dark:bg-foreground dark:text-background")}
          >
            <Moon className="size-4.5" />
          </button>
        </div>

        {rail.length > 0 && (
          <nav className={cn(pill, "my-auto")}>
            {rail.map((item) => (
              <RailTip key={item.url} label={item.title}>
                <Link
                  href={item.url}
                  aria-label={item.title}
                  className={cn(
                    railButton,
                    isActiveItem(pathname, item)
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground",
                  )}
                >
                  <item.icon className="size-4.5" />
                </Link>
              </RailTip>
            ))}
          </nav>
        )}

        <div className={pill}>
          {settingsItems.map((item) => (
            <RailTip key={item.url} label={item.title}>
              <Link
                href={item.url}
                aria-label={item.title}
                className={cn(
                  railButton,
                  isActiveItem(pathname, item)
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                <item.icon className="size-4.5" />
              </Link>
            </RailTip>
          ))}
          <RailTip label="Sign out">
            <button
              type="button"
              aria-label="Sign out"
              onClick={handleSignOut}
              className={cn(railButton, "text-muted-foreground hover:bg-destructive/10 hover:text-destructive")}
            >
              <LogOut className="size-4.5" />
            </button>
          </RailTip>
        </div>
      </aside>
    </TooltipProvider>
  );
}
