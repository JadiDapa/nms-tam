import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowDown, ArrowUp, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { StatusBadge } from "./StatusBadge";

type Tone = Parameters<typeof StatusBadge>[0]["tone"];

type Props = {
  label: string;
  value: string | number;
  icon: LucideIcon;
  // Small badge under the value (arrow optional) followed by a muted caption, e.g. "↑ 7%  This month".
  pill?: { label: string; tone: Tone; arrow?: "up" | "down" };
  caption?: string;
  // The highlighted tile: orange gradient with white text.
  featured?: boolean;
  // "md" for long values such as money ("Rp 1.250.000"); the default is for short counts
  size?: "md" | "lg";
  // makes the whole tile a link (a small arrow shows it)
  href?: string;
  className?: string;
};

// White panel that holds the stat tiles (they turn light gray inside it, like the reference).
export function StatGroup({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div data-slot="stat-group" className={cn("bg-card grid grid-cols-2 gap-3 rounded-3xl p-3 shadow-xs", className)}>
      {children}
    </div>
  );
}

// Label + icon chip on top, big number, then a badge and caption.
export function StatCard({ label, value, icon: Icon, pill, caption, featured, size = "lg", href, className }: Props) {
  const Arrow = pill?.arrow === "up" ? ArrowUp : pill?.arrow === "down" ? ArrowDown : null;

  const shell = {
    "data-slot": "stat-card",
    className: cn(
      "flex min-w-0 flex-col justify-between gap-8 rounded-3xl p-5",
      featured ? "from-primary bg-linear-to-b to-[oklch(0.62_0.2_34)] text-white" : "bg-card text-card-foreground in-data-[slot=stat-group]:bg-muted",
      href && "group transition-all hover:-translate-y-0.5 hover:shadow-md",
      className,
    ),
  };

  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className={cn("text-base leading-snug font-medium", featured ? "text-white" : "text-foreground/80")}>{label}</p>
        <span
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-[12px]",
            featured ? "bg-white/20 text-white" : "bg-background text-foreground/80 in-data-[slot=stat-group]:bg-card border",
          )}
        >
          {href ? (
            <>
              <Icon className="size-5 group-hover:hidden" />
              <ArrowUpRight className="hidden size-5 group-hover:block" />
            </>
          ) : (
            <Icon className="size-5" />
          )}
        </span>
      </div>

      <div className="space-y-3">
        <p className={cn("truncate font-medium tracking-tight", size === "md" ? "text-2xl xl:text-3xl" : "text-4xl xl:text-5xl")}>{value}</p>
        {(pill || caption) && (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            {pill &&
              (featured ? (
                <span className="inline-flex items-center gap-0.5 rounded-[6px] bg-white/20 px-2 py-1 text-xs font-medium whitespace-nowrap">
                  {Arrow && <Arrow className="size-3" />}
                  {pill.label}
                </span>
              ) : (
                <StatusBadge label={pill.label} tone={pill.tone} className="rounded-[6px]" icon={Arrow && <Arrow className="size-3" />} />
              ))}
            {caption && <span className={cn("text-xs", featured ? "text-white/85" : "text-muted-foreground")}>{caption}</span>}
          </div>
        )}
      </div>
    </>
  );

  return href ? (
    <Link href={href} {...shell}>
      {content}
    </Link>
  ) : (
    <div {...shell}>{content}</div>
  );
}
