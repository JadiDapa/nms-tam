// Rebuilds "how was the device doing over the last day" from the engine's state-change log.
// Pure: the caller passes "now". Anything the log cannot tell us stays "unknown" instead of being guessed.

export type StateChange = { kind: string; from: string; to: string; at: string | Date; reason?: string | null };

export type RibbonState = "up" | "warning" | "down" | "unknown";

export type RibbonSegment = { start: number; end: number; state: RibbonState };

const bucketOf = (health: string): RibbonState => {
  if (health === "UP") return "up";
  if (health === "DOWN") return "down";
  if (health === "DEGRADED" || health === "RECOVERING") return "warning";
  return "unknown";
};

// When a slice holds several states, the worst one wins so a short outage never disappears from the picture.
const WORST: RibbonState[] = ["down", "warning", "up", "unknown"];

type Interval = { start: number; end: number; state: RibbonState };

export function reachabilityRibbon(o: {
  changes: StateChange[];
  currentState: string;
  // when the current state began (null when unknown)
  since: string | Date | null;
  now: number;
  windowMs: number;
  segments: number;
  // the log is capped: when it is full, the time before its oldest entry is not known
  truncated: boolean;
}): { segments: RibbonSegment[]; availabilityPct: number | null } {
  const windowStart = o.now - o.windowMs;
  const changes = o.changes
    .filter((c) => c.kind === "reachability")
    .map((c) => ({ ...c, t: new Date(c.at).getTime() }))
    .sort((a, b) => a.t - b.t);

  const raw: Interval[] = [];
  if (changes.length === 0) {
    const since = o.since ? new Date(o.since).getTime() : windowStart;
    const from = Math.max(windowStart, since);
    if (from > windowStart) raw.push({ start: windowStart, end: from, state: "unknown" });
    raw.push({ start: from, end: o.now, state: bucketOf(o.currentState) });
  } else {
    raw.push({ start: windowStart, end: changes[0].t, state: o.truncated ? "unknown" : bucketOf(changes[0].from) });
    changes.forEach((c, i) => raw.push({ start: c.t, end: changes[i + 1]?.t ?? o.now, state: bucketOf(c.to) }));
  }

  // clip to the window, drop empty pieces
  const intervals = raw
    .map((r) => ({ ...r, start: Math.max(r.start, windowStart), end: Math.min(r.end, o.now) }))
    .filter((r) => r.end > r.start);

  const sliceMs = o.windowMs / o.segments;
  const segments: RibbonSegment[] = Array.from({ length: o.segments }, (_, i) => {
    const start = windowStart + i * sliceMs;
    const end = start + sliceMs;
    const present = new Set(intervals.filter((r) => r.end > start && r.start < end).map((r) => r.state));
    const state = WORST.find((s) => present.has(s)) ?? "unknown";
    return { start, end, state };
  });

  let known = 0;
  let reachable = 0;
  for (const r of intervals) {
    if (r.state === "unknown") continue;
    const d = r.end - r.start;
    known += d;
    if (r.state !== "down") reachable += d;
  }
  return { segments, availabilityPct: known > 0 ? (reachable / known) * 100 : null };
}

export type ChangeEntry = StateChange & {
  // the change as a timestamp (ms)
  t: number;
  // how long the state it left had lasted (since the previous change of the same kind); null for the oldest one we know of
  lastedMs: number | null;
};

// Prepares the state-change log for a feed: newest first, each entry knowing how long the previous state lasted.
// Reachability and SNMP are separate tracks, so their changes are never measured against each other.
export function describeChanges(changes: StateChange[]): ChangeEntry[] {
  const withTime = changes.map((c) => ({ ...c, t: new Date(c.at).getTime() })).sort((a, b) => a.t - b.t);
  const lastByKind = new Map<string, number>();
  const entries: ChangeEntry[] = withTime.map((c) => {
    const prev = lastByKind.get(c.kind);
    lastByKind.set(c.kind, c.t);
    return { ...c, lastedMs: prev === undefined ? null : c.t - prev };
  });
  return entries.reverse();
}
