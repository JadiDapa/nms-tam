"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import FormField from "../FormField";

const LocationPickerMap = dynamic(() => import("./LocationPickerMap"), {
  ssr: false,
  loading: () => <Skeleton className="h-64 w-full rounded-xl" />,
});

type Props = {
  latitude: number | null | undefined;
  longitude: number | null | undefined;
  onChange: (latitude: number | null, longitude: number | null) => void;
  error?: string;
};

const show = (n: number | null | undefined) => (n === null || n === undefined ? "" : String(n));
const parse = (text: string) => {
  const t = text.trim();
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
};
// 6 decimals is about 10 cm, plenty for a map pin
const round = (n: number) => Math.round(n * 1e6) / 1e6;

// Pick where a device stands: click or drag on the map, or type the coordinates.
export default function LocationPicker({ latitude, longitude, onChange, error }: Props) {
  // The text boxes own what is typed; the numbers go up to the form. (Only this component changes them, so no syncing is needed.)
  const [latText, setLatText] = useState(show(latitude));
  const [lngText, setLngText] = useState(show(longitude));

  const lat = parse(latText);
  const lng = parse(lngText);
  const pinned = lat !== null && lng !== null && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null;

  function typed(nextLat: string, nextLng: string) {
    setLatText(nextLat);
    setLngText(nextLng);
    onChange(parse(nextLat), parse(nextLng));
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <FormField label="Latitude" htmlFor="latitude" optional>
          <Input id="latitude" inputMode="decimal" value={latText} onChange={(e) => typed(e.target.value, lngText)} placeholder="-2.9909" />
        </FormField>
        <FormField label="Longitude" htmlFor="longitude" optional>
          <Input id="longitude" inputMode="decimal" value={lngText} onChange={(e) => typed(latText, e.target.value)} placeholder="104.7566" />
        </FormField>
        <Button type="button" variant="outline" size="icon" aria-label="Clear location" title="Clear location" disabled={!latText && !lngText} onClick={() => typed("", "")}>
          <X />
        </Button>
      </div>
      {error && <p className="text-destructive text-sm">{error}</p>}
      <LocationPickerMap value={pinned} onPick={(p) => typed(String(round(p.lat)), String(round(p.lng)))} />
      <p className="text-muted-foreground text-xs">Click the map to place the device, then drag the pin to fine-tune it.</p>
    </div>
  );
}
