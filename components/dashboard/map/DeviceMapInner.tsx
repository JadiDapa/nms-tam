"use client";

import "leaflet/dist/leaflet.css";

import { useEffect } from "react";
import Link from "next/link";
import L from "leaflet";
import { MapContainer, Marker, Popup, TileLayer, useMap } from "react-leaflet";
import { MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatMs, timeAgo } from "@/lib/format";
import { StatusBadge } from "../StatusBadge";
import { DEFAULT_CENTER, DEFAULT_ZOOM, TILE_ATTRIBUTION, TILE_URL } from "./map-config";
import { pinIcon } from "./marker-icon";
import { MAP_STATES, STATE_META, type MapPoint } from "./map-types";

// Fits the view to the devices when the set of positions changes, never on a plain refresh (that would undo the user's pan and zoom).
function FitToPoints({ coordsKey }: { coordsKey: string }) {
  const map = useMap();
  useEffect(() => {
    const coords: [number, number][] = JSON.parse(coordsKey);
    if (coords.length === 0) return;
    if (coords.length === 1) map.setView(coords[0], 11);
    else map.fitBounds(L.latLngBounds(coords), { padding: [56, 56], maxZoom: 12 });
  }, [coordsKey, map]);
  return null;
}

export default function DeviceMapInner({ points }: { points: MapPoint[] }) {
  const coordsKey = JSON.stringify(points.map((p) => [p.lat, p.lng]));
  const counts = Object.fromEntries(MAP_STATES.map((s) => [s, points.filter((p) => p.state === s).length]));

  return (
    // "isolate" keeps Leaflet's high z-indexes inside the map, so it never draws over the sticky top bar or menus
    <div className="relative isolate h-[460px] overflow-hidden rounded-2xl">
      <MapContainer center={DEFAULT_CENTER} zoom={DEFAULT_ZOOM} scrollWheelZoom={false} className="h-full w-full">
        <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} />
        <FitToPoints coordsKey={coordsKey} />
        {points.map((p) => (
          <Marker key={p.id} position={[p.lat, p.lng]} icon={pinIcon(STATE_META[p.state].color, p.state !== "paused")}>
            <Popup>
              <div className="min-w-44 space-y-2">
                <div>
                  <Link href={`/dashboard/devices/${p.id}`} className="text-sm font-semibold hover:underline">
                    {p.name}
                  </Link>
                  <p className="text-muted-foreground text-xs">{p.host}</p>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <StatusBadge label={STATE_META[p.state].label} tone={STATE_META[p.state].tone} className="rounded-[6px]" />
                  <span className="text-xs font-medium">{formatMs(p.latencyMs)}</span>
                </div>
                <p className="text-muted-foreground text-xs">Last poll {timeAgo(p.lastPollAt)}</p>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      <div className="bg-card/95 absolute bottom-4 left-4 z-1000 min-w-44 space-y-2 rounded-2xl p-3 text-xs shadow-md backdrop-blur">
        <p className="text-sm font-semibold">Device status</p>
        {MAP_STATES.map((s) => (
          <div key={s} className="flex items-center gap-2">
            <span className="size-2.5 rounded-full" style={{ background: STATE_META[s].color }} />
            <span>{STATE_META[s].label}</span>
            <span className="text-muted-foreground ml-auto">{counts[s]}</span>
          </div>
        ))}
      </div>

      {points.length === 0 && (
        <div className="absolute inset-0 z-1000 flex items-center justify-center p-6">
          <div className="bg-card/95 max-w-xs space-y-3 rounded-2xl p-5 text-center shadow-md backdrop-blur">
            <span className="bg-muted mx-auto flex size-10 items-center justify-center rounded-full">
              <MapPin className="size-5" />
            </span>
            <p className="text-sm font-medium">No device has a location yet</p>
            <p className="text-muted-foreground text-xs">Open a device, go to Settings and place it on the map.</p>
            <Button asChild size="sm" className="rounded-xl">
              <Link href="/dashboard/devices">Go to devices</Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
