import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import DeviceMapLoader from "./DeviceMapLoader";
import type { MapPoint } from "./map-types";

// Geographic view of the client's devices: where each one is and whether it is up.
export default function DeviceMapCard({ points, unlocated, className }: { points: MapPoint[]; unlocated: number; className?: string }) {
  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div className="space-y-1">
          <CardTitle className="text-xl">Device map</CardTitle>
          <CardDescription>Where your devices are and how they are doing right now</CardDescription>
        </div>
        {unlocated > 0 && (
          <Link
            href="/dashboard/devices"
            className="text-muted-foreground hover:text-foreground bg-muted shrink-0 rounded-[6px] px-2 py-1 text-xs font-medium whitespace-nowrap transition-colors"
          >
            {unlocated} without location
          </Link>
        )}
      </CardHeader>
      <CardContent>
        <DeviceMapLoader points={points} />
      </CardContent>
    </Card>
  );
}
