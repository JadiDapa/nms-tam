"use client";

import "leaflet/dist/leaflet.css";

import { useEffect } from "react";
import type { Marker as LeafletMarker } from "leaflet";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { DEFAULT_CENTER, DEFAULT_ZOOM, TILE_ATTRIBUTION, TILE_URL } from "./map-config";
import { pinIcon } from "./marker-icon";

type Pos = { lat: number; lng: number };

function ClickToPlace({ onPick }: { onPick: (p: Pos) => void }) {
  useMapEvents({ click: (e) => onPick({ lat: e.latlng.lat, lng: e.latlng.lng }) });
  return null;
}

// Brings a typed-in position into view.
function Follow({ value }: { value: Pos | null }) {
  const map = useMap();
  const lat = value?.lat;
  const lng = value?.lng;
  useEffect(() => {
    if (lat === undefined || lng === undefined) return;
    map.setView([lat, lng], Math.max(map.getZoom(), 9));
  }, [lat, lng, map]);
  return null;
}

export default function LocationPickerMap({ value, onPick }: { value: Pos | null; onPick: (p: Pos) => void }) {
  return (
    <div className="relative isolate h-64 overflow-hidden rounded-xl border">
      <MapContainer
        center={value ? [value.lat, value.lng] : DEFAULT_CENTER}
        zoom={value ? 10 : DEFAULT_ZOOM}
        scrollWheelZoom={false}
        className="h-full w-full cursor-crosshair"
      >
        <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} />
        <ClickToPlace onPick={onPick} />
        <Follow value={value} />
        {value && (
          <Marker
            position={[value.lat, value.lng]}
            icon={pinIcon("#ff5c35", false)}
            draggable
            eventHandlers={{
              dragend: (e) => {
                const p = (e.target as LeafletMarker).getLatLng();
                onPick({ lat: p.lat, lng: p.lng });
              },
            }}
          />
        )}
      </MapContainer>
    </div>
  );
}
