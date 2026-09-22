// Base map. Defaults to the public OpenStreetMap tiles (fine for light use, attribution required). For heavy traffic point
// NEXT_PUBLIC_MAP_TILE_URL at a tile provider you have an account with, and set NEXT_PUBLIC_MAP_ATTRIBUTION to what it requires.
export const TILE_URL = process.env.NEXT_PUBLIC_MAP_TILE_URL || "https://tile.openstreetmap.org/{z}/{x}/{y}.png";

export const TILE_ATTRIBUTION =
  process.env.NEXT_PUBLIC_MAP_ATTRIBUTION || '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

// Where the map starts before there is anything to show: Indonesia.
export const DEFAULT_CENTER: [number, number] = [-2.5, 118];
export const DEFAULT_ZOOM = 5;
