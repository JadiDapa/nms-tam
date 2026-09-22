import { cn } from "@/lib/utils";

const W = 100;
const H = 28;
const PAD = 3;

// Tiny trend line. Missing readings leave a gap instead of being joined across.
export default function Sparkline({ values, className }: { values: (number | null)[]; className?: string }) {
  const known = values.filter((v): v is number => v !== null);
  if (known.length < 2) {
    return <div className={cn("h-7 w-full border-b border-dashed border-foreground/20", className)} aria-hidden />;
  }

  const min = Math.min(...known);
  const span = Math.max(...known) - min;
  const x = (i: number) => (i / (values.length - 1)) * W;
  // a flat line sits in the middle rather than on the floor
  const y = (v: number) => (span === 0 ? H / 2 : H - PAD - ((v - min) / span) * (H - PAD * 2));

  let d = "";
  let open = false;
  values.forEach((v, i) => {
    if (v === null) {
      open = false;
      return;
    }
    d += `${open ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)} `;
    open = true;
  });

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className={cn("h-7 w-full", className)} aria-hidden>
      <path d={d} fill="none" stroke="var(--primary)" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
