import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// Placeholder shown while a chart is loading (same frame as the real chart so nothing jumps).
export default function ChartCardSkeleton({ className, compact = false }: { className?: string; compact?: boolean }) {
  if (compact) {
    return (
      <Card className={cn("gap-3 py-4", className)}>
        <CardHeader className="px-5">
          <Skeleton className="h-5 w-24" />
        </CardHeader>
        <CardContent className="flex min-h-0 flex-1 flex-col px-3">
          <Skeleton className="min-h-40 flex-1 rounded-2xl" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <Skeleton className="h-6 w-28" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col">
        <Skeleton className="min-h-72 flex-1 rounded-2xl" />
      </CardContent>
    </Card>
  );
}
