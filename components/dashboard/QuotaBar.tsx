import { Progress } from "@/components/ui/progress";

// "13 of 29 slots" with a bar that turns red when full.
export default function QuotaBar({ label, used, limit }: { label: string; used: number; limit: number }) {
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const full = limit > 0 && used >= limit;

  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className={full ? "text-destructive font-medium" : "font-medium"}>
          {used} of {limit}
        </span>
      </div>
      <Progress value={pct} className={full ? "[&>div]:bg-destructive" : undefined} />
    </div>
  );
}
