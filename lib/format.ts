import { format, formatDistanceToNowStrict } from "date-fns";

const idr = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

export const formatIDR = (amount: number) => idr.format(amount);

// "Rp 1,5 jt" style, for chart axes and tight spaces.
const idrCompact = new Intl.NumberFormat("id-ID", { notation: "compact", maximumFractionDigits: 1 });
export const formatIDRCompact = (amount: number) => `Rp ${idrCompact.format(amount)}`;

export const formatDate = (d: Date | string | null | undefined) =>
  d ? format(new Date(d), "dd MMM yyyy") : "—";

export const formatDateTime = (d: Date | string | null | undefined) =>
  d ? format(new Date(d), "dd MMM yyyy HH:mm") : "—";

export const timeAgo = (d: Date | string | null | undefined) =>
  d ? `${formatDistanceToNowStrict(new Date(d))} ago` : "never";

export function formatBps(bps: number | null | undefined) {
  if (bps === null || bps === undefined) return "—";
  const units = ["bps", "Kbps", "Mbps", "Gbps", "Tbps"];
  let v = bps;
  let i = 0;
  while (v >= 1000 && i < units.length - 1) {
    v /= 1000;
    i++;
  }
  return `${v.toFixed(v >= 100 || i === 0 ? 0 : 1)} ${units[i]}`;
}

export function formatBytes(bytes: number | null | undefined) {
  if (bytes === null || bytes === undefined) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let v = bytes;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(i === 0 ? 0 : v >= 100 ? 1 : 2)} ${units[i]}`;
}

export const formatPct = (v: number | null | undefined) =>
  v === null || v === undefined ? "—" : `${v.toFixed(v >= 10 ? 0 : 1)}%`;

export const formatMs = (v: number | null | undefined) =>
  v === null || v === undefined ? "—" : `${v.toFixed(v >= 10 ? 0 : 1)} ms`;

// "45s", "3m 12s", "1h 12m", "2d 3h": a span of time in its two biggest units.
export function formatDuration(ms: number) {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${m % 60}m`;
  return `${Math.floor(h / 24)}d ${h % 24}h`;
}
