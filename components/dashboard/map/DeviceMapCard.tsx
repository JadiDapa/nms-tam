import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import DeviceMapLoader from "./DeviceMapLoader";
import type { MapPoint } from "./map-types";

// Geographic view of the client's devices: where each one is and whether it is up. `devicesHref` points the
// "without location" badge at the devices list; omit it (e.g. the admin looking at a client's fleet, which has
// no admin-facing devices route) to render a plain, non-clickable badge instead.
export default function DeviceMapCard({ points, unlocated, devicesHref, className }: { points: MapPoint[]; unlocated: number; devicesHref?: string; className?: string }) {
  const badgeClass = "text-muted-foreground bg-muted shrink-0 rounded-[6px] px-2 py-1 text-xs font-medium whitespace-nowrap";
  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div className="space-y-1">
          <CardTitle className="text-xl">Device map</CardTitle>
          <CardDescription>Where your devices are and how they are doing right now</CardDescription>
        </div>
        {unlocated > 0 &&
          (devicesHref ? (
            <Link href={devicesHref} className={cn(badgeClass, "hover:text-foreground transition-colors")}>
              {unlocated} without location
            </Link>
          ) : (
            <span className={badgeClass}>{unlocated} without location</span>
          ))}
      </CardHeader>
      <CardContent>
        <DeviceMapLoader points={points} />
      </CardContent>
    </Card>
  );
}
