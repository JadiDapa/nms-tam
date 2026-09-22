import { describe, expect, it } from "vitest";
import { describeChanges, reachabilityRibbon, type StateChange } from "./availability";

const H = 3_600_000;
const NOW = Date.UTC(2026, 8, 21, 12, 0, 0);
const base = { now: NOW, windowMs: 24 * H, segments: 48, truncated: false };
const change = (hoursAgo: number, from: string, to: string, kind = "reachability"): StateChange => ({
  kind,
  from,
  to,
  at: new Date(NOW - hoursAgo * H),
});

describe("reachabilityRibbon", () => {
  it("a device that has been up longer than the window is up all day", () => {
    const r = reachabilityRibbon({ ...base, changes: [], currentState: "UP", since: new Date(NOW - 100 * H) });
    expect(r.segments).toHaveLength(48);
    expect(r.segments.every((s) => s.state === "up")).toBe(true);
    expect(r.availabilityPct).toBe(100);
  });

  it("time before the current state began is unknown, not guessed", () => {
    const r = reachabilityRibbon({ ...base, changes: [], currentState: "UP", since: new Date(NOW - 6 * H) });
    expect(r.segments.slice(0, 36).every((s) => s.state === "unknown")).toBe(true);
    expect(r.segments.slice(36).every((s) => s.state === "up")).toBe(true);
    expect(r.availabilityPct).toBe(100); // only known time counts
  });

  it("shows an outage and counts it against availability", () => {
    // down from 6 h ago to 5 h ago, up again since
    const r = reachabilityRibbon({
      ...base,
      changes: [change(5, "DOWN", "UP"), change(6, "UP", "DOWN")],
      currentState: "UP",
      since: new Date(NOW - 5 * H),
    });
    expect(r.segments.filter((s) => s.state === "down")).toHaveLength(2); // two 30-minute slices per hour
    expect(r.availabilityPct).toBeCloseTo((23 / 24) * 100, 5);
  });

  it("degraded and recovering count as reachable but are drawn as a warning", () => {
    const r = reachabilityRibbon({
      ...base,
      changes: [change(2, "UP", "DEGRADED")],
      currentState: "DEGRADED",
      since: new Date(NOW - 2 * H),
    });
    expect(r.segments.slice(-4).every((s) => s.state === "warning")).toBe(true);
    expect(r.availabilityPct).toBe(100);
  });

  it("when the log is full, time before its oldest entry is unknown", () => {
    const r = reachabilityRibbon({ ...base, truncated: true, changes: [change(10, "DOWN", "UP")], currentState: "UP", since: new Date(NOW - 10 * H) });
    expect(r.segments.slice(0, 28).every((s) => s.state === "unknown")).toBe(true);
    expect(r.segments.slice(28).every((s) => s.state === "up")).toBe(true);
  });

  it("ignores SNMP state changes", () => {
    const r = reachabilityRibbon({ ...base, changes: [change(3, "UP", "DOWN", "snmp")], currentState: "UP", since: new Date(NOW - 50 * H) });
    expect(r.segments.every((s) => s.state === "up")).toBe(true);
  });

  it("a slice with an outage shows the outage even if most of it was up", () => {
    // down for 10 minutes inside one 30-minute slice
    const r = reachabilityRibbon({
      ...base,
      changes: [
        { kind: "reachability", from: "DOWN", to: "UP", at: new Date(NOW - 3 * H + 10 * 60_000) },
        { kind: "reachability", from: "UP", to: "DOWN", at: new Date(NOW - 3 * H) },
      ],
      currentState: "UP",
      since: new Date(NOW - 3 * H + 10 * 60_000),
    });
    expect(r.segments.filter((s) => s.state === "down")).toHaveLength(1);
  });

  it("has no availability figure when nothing is known", () => {
    const r = reachabilityRibbon({ ...base, changes: [], currentState: "UNKNOWN", since: null });
    expect(r.availabilityPct).toBeNull();
    expect(r.segments.every((s) => s.state === "unknown")).toBe(true);
  });
});


describe("describeChanges", () => {
  const at = (h: number) => new Date(NOW - h * H);

  it("lists newest first and says how long the state it left had lasted", () => {
    const r = describeChanges([
      { kind: "reachability", from: "UNKNOWN", to: "UP", at: at(10) },
      { kind: "reachability", from: "UP", to: "DOWN", at: at(4) },
      { kind: "reachability", from: "DOWN", to: "UP", at: at(3) },
    ]);
    expect(r.map((c) => c.to)).toEqual(["UP", "DOWN", "UP"]);
    expect(r[0].lastedMs).toBe(1 * H); // it was down for one hour
    expect(r[1].lastedMs).toBe(6 * H); // it was up for six hours
    expect(r[2].lastedMs).toBeNull(); // nothing older to measure against
  });

  it("measures reachability and SNMP separately", () => {
    const r = describeChanges([
      { kind: "reachability", from: "UNKNOWN", to: "UP", at: at(10) },
      { kind: "snmp", from: "UNKNOWN", to: "UP", at: at(9) },
      { kind: "snmp", from: "UP", to: "DEGRADED", at: at(2) },
    ]);
    const snmp = r.find((c) => c.to === "DEGRADED")!;
    expect(snmp.lastedMs).toBe(7 * H); // since the earlier SNMP change, not the reachability one
  });

  it("copes with an empty log", () => {
    expect(describeChanges([])).toEqual([]);
  });
});
