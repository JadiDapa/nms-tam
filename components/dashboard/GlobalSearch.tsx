"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { menuFor, settingsItems } from "@/lib/sidebar-menu";
import { Command, CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { headerIconButton } from "./header-styles";

// Jump-to-page palette (Ctrl/Cmd + K). Lists only the pages this role can open.
export default function GlobalSearch({ role }: { role: string }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const pages = [...menuFor(role).all, ...settingsItems];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <button type="button" aria-label="Search pages" title="Search (Ctrl K)" onClick={() => setOpen(true)} className={headerIconButton}>
        <Search className="size-4.5" />
      </button>

      <CommandDialog open={open} onOpenChange={setOpen} title="Search" description="Jump to a page">
        <Command>
          <CommandInput placeholder="Search pages..." />
          <CommandList>
            <CommandEmpty>No pages found.</CommandEmpty>
            <CommandGroup heading="Pages">
              {pages.map((page) => (
                <CommandItem
                  key={page.url}
                  value={page.title}
                  onSelect={() => {
                    setOpen(false);
                    router.push(page.url);
                  }}
                >
                  <page.icon />
                  {page.title}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </CommandDialog>
    </>
  );
}
