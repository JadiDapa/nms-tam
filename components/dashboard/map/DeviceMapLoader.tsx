"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

// Leaflet needs the browser (it touches `window` on import), so the map is loaded on the client only.
const DeviceMapInner = dynamic(() => import("./DeviceMapInner"), {
  ssr: false,
  loading: () => <Skeleton className="h-[460px] w-full rounded-2xl" />,
});

export default DeviceMapInner;
