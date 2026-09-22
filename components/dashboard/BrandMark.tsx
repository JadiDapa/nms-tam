import Link from "next/link";
import { Activity } from "lucide-react";

export function BrandMark({ className, compactOnMobile }: { className?: string; compactOnMobile?: boolean }) {
  return (
    <Link href="/dashboard" className={className}>
      <span className="bg-primary text-primary-foreground flex size-10 items-center justify-center rounded-xl">
        <Activity className="size-5" strokeWidth={2.25} />
      </span>
      <span className={compactOnMobile ? "text-foreground text-base font-semibold tracking-tight max-sm:hidden" : "text-foreground text-base font-semibold tracking-tight"}>
        NMS TAM
      </span>
    </Link>
  );
}
