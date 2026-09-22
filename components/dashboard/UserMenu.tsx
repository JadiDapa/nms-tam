"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useClerk } from "@clerk/nextjs";
import { useTheme } from "next-themes";
import { ChevronDown, LogOut, Monitor, Moon, Sun, UserCog } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { displayName, initialOf, type ShellUser } from "./shell-types";

export default function UserMenu({ user, orgName }: { user: ShellUser; orgName?: string | null }) {
  const { signOut } = useClerk();
  const { theme, setTheme } = useTheme();
  const router = useRouter();

  const handleSignOut = async () => {
    await signOut();
    router.replace("/sign-in");
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="bg-card text-card-foreground focus-visible:ring-ring/50 flex h-14 items-center gap-2.5 rounded-full py-2 pr-4 pl-2 shadow-xs outline-none transition-colors focus-visible:ring-[3px]"
        >
          <span className="bg-primary text-primary-foreground flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold">
            {initialOf(user)}
          </span>
          <span className="hidden max-w-44 min-w-0 flex-col text-left leading-tight sm:flex">
            <span className="truncate text-sm font-semibold">{displayName(user)}</span>
            <span className="text-muted-foreground truncate text-xs">{orgName ?? "Administration"}</span>
          </span>
          <ChevronDown className="text-muted-foreground size-4 shrink-0" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="flex flex-col gap-0.5 px-3 py-2">
          <span className="text-foreground truncate text-sm font-semibold">{displayName(user)}</span>
          <span className="text-muted-foreground truncate text-xs font-normal">{user.email}</span>
          <span className="text-muted-foreground text-xs font-normal capitalize">{user.role.toLowerCase()}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem asChild>
            <Link href="/dashboard/profile">
              <UserCog />
              Profile &amp; Security
            </Link>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-muted-foreground px-3 py-1 text-xs font-medium">Theme</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={theme} onValueChange={setTheme}>
          <DropdownMenuRadioItem value="light">
            <Sun className="size-4" />
            Light
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="dark">
            <Moon className="size-4" />
            Dark
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="system">
            <Monitor className="size-4" />
            System
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={handleSignOut}>
          <LogOut />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
