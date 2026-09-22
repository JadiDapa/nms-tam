import { describe, expect, it } from "vitest";
import { formatReading, incidentsByDay, meanResolveMs } from "./incident-stats";

const NOW = new Date(2026, 8, 21, 15, 0, 0);
const inc = (daysAgo: number, severity: string, status = "RESOLVED", mins = 30) => {
  const start = new Date(NOW.getTime() - daysAgo * 86_400_000);
  return { severity, status, triggeredAt: start.toISOString(), resolvedAt: status === "RESOLVED" ? new Date(start.getTime() + mins * 60_000).toISOString() : null };
};

describe("incidentsByDay", () => {
  it("lists every day of the window, oldest first, with zeros for quiet days", () => {
    const r = incidentsByDay([], 7, NOW);
    expect(r).toHaveLength(7);
    expect(r[0].key).toBe("2026-09-15");
    expect(r[6].key).toBe("2026-09-21");
    expect(r.every((b) => b.total === 0)).toBe(true);
  });

  it("counts by severity on the day the incident started", () => {
    const r = incidentsByDay([inc(0, "critical"), inc(0, "warning"), inc(0, "warning"), inc(2, "info")], 7, NOW);
    expect(r[6]).toMatchObject({ critical: 1, warning: 2, info: 0, total: 3 });
    expect(r[4]).toMatchObject({ info: 1, total: 1 });
  });

  it("ignores incidents older than the window and unknown severities", () => {
    const r = incidentsByDay([inc(30, "critical"), inc(0, "weird")], 7, NOW);
    expect(r.reduce((s, b) => s + b.total, 0)).toBe(0);
  });
});

describe("meanResolveMs", () => {
  it("averages only resolved incidents that ended inside the window", () => {
    const since = NOW.getTime() - 10 * 86_400_000;
    const r = meanResolveMs([inc(1, "critical", "RESOLVED", 30), inc(2, "warning", "RESOLVED", 90), inc(1, "info", "OPEN"), inc(20, "info", "RESOLVED", 600)], since);
    expect(r).toBe(60 * 60_000); // (30 + 90) / 2 minutes
  });

  it("has no answer when nothing was resolved", () => {
    expect(meanResolveMs([inc(1, "critical", "OPEN")], 0)).toBeNull();
  });
});

describe("formatReading", () => {
  it("writes each kind of reading the way people say it", () => {
    expect(formatReading("cpu_pct", 94.123)).toBe("94.1%");
    expect(formatReading("icmp_latency_ms", 343.8)).toBe("344 ms");
    expect(formatReading("if_in_bps", 12.34)).toBe("12.3");
    expect(formatReading("cpu_pct", null)).toBeNull();
  });
});
