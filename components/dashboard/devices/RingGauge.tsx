import { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Props = {
  // 0-100, or null when there is no reading
  value: number | null;
  size?: number;
  stroke?: number;
  className?: string;
  children?: ReactNode;
};

// A round usage gauge: black while healthy, amber from 75%, red from 90% (the same thresholds as the meters on the device cards).
export default function RingGauge({ value, size = 112, stroke = 10, className, children }: Props) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = value === null ? 0 : Math.min(100, Math.max(0, value));
  const arc = value === null ? "stroke-transparent" : pct >= 90 ? "stroke-red-500" : pct >= 75 ? "stroke-amber-500" : "stroke-foreground";

  return (
    <div className={cn("relative shrink-0", className)} style={{ width: size, height: size }} role="img" aria-label={value === null ? "no reading" : `${Math.round(pct)} percent`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-foreground/10" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${(pct / 100) * c} ${c}`}
          className={cn("transition-[stroke-dasharray]", arc)}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  );
}
