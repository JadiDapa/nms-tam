import L from "leaflet";

// A round pin with an optional pulsing halo (styled in globals.css). Icons are cached so a re-render never rebuilds them.
const cache = new Map<string, L.DivIcon>();

export function pinIcon(color: string, pulse = true) {
  const key = `${color}:${pulse}`;
  let icon = cache.get(key);
  if (!icon) {
    icon = L.divIcon({
      className: "nms-pin-wrap",
      html: `<span class="nms-pin${pulse ? " nms-pin-pulse" : ""}" style="--pin:${color}"></span>`,
      iconSize: [18, 18],
      iconAnchor: [9, 9],
      popupAnchor: [0, -10],
    });
    cache.set(key, icon);
  }
  return icon;
}
