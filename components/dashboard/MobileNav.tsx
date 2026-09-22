"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { isActiveItem, menuFor } from "@/lib/sidebar-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { BrandMark } from "./BrandMark";

// Below `lg` the top pill and the rail are hidden; every page is reachable from this drawer instead.
export default function MobileNav({ role }: { role: string }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { all } = menuFor(role);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          aria-label="Open menu"
          className="bg-card text-foreground flex size-14 items-center justify-center rounded-full shadow-xs lg:hidden"
        >
          <Menu className="size-5" />
        </button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 gap-0 p-0" data-app-chrome>
        <SheetHeader className="border-b px-5 py-4">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <BrandMark className="flex items-center gap-2.5" />
        </SheetHeader>
        <nav className="flex flex-col gap-1 p-3">
          {all.map((item) => (
            <Link
              key={item.url}
              href={item.url}
              onClick={() => setOpen(false)}
              className={cn(
                "flex h-11 items-center gap-3 rounded-full px-4 text-sm font-medium transition-colors",
                isActiveItem(pathname, item)
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              <item.icon className="size-4 shrink-0" />
              {item.title}
            </Link>
          ))}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
