import Link from "next/link";
import Image from "next/image";

export function BrandMark({ className, compactOnMobile }: { className?: string; compactOnMobile?: boolean }) {
  return (
    <Link href="/dashboard" className={className}>
      <span className="flex size-10 items-center justify-center rounded-xl">
        <Image src="/logo.png" alt="Netpulse" width={40} height={40} className="size-10 object-contain" priority />
      </span>
      <span className={compactOnMobile ? "text-foreground text-base font-semibold tracking-tight max-sm:hidden" : "text-foreground text-base font-semibold tracking-tight"}>
        Netpulse
      </span>
    </Link>
  );
}
