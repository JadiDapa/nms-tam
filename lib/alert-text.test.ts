import { describe, expect, it } from "vitest";
import { ruleHeadline, ruleTiming, type RuleText } from "./alert-text";

const base: RuleText = { conditionType: "metric_threshold", metric: "cpu_pct", operator: ">", threshold: 90, triggerAfter: 3, clearAfter: 3, cooldownSec: 300, notifyOnRecovery: true };

describe("ruleHeadline", () => {
  it("writes threshold rules with the metric's own unit", () => {
    expect(ruleHeadline(base)).toBe("CPU usage goes above 90%");
    expect(ruleHeadline({ ...base, metric: "icmp_latency_ms", threshold: 500 })).toBe("Ping latency goes above 500 ms");
    expect(ruleHeadline({ ...base, operator: "<", metric: "memory_pct", threshold: 10 })).toBe("Memory usage drops below 10%");
  });

  it("describes the fixed conditions", () => {
    expect(ruleHeadline({ ...base, conditionType: "device_down" })).toBe("The device stops answering");
    expect(ruleHeadline({ ...base, conditionType: "snmp_unavailable" })).toBe("SNMP stops responding");
    expect(ruleHeadline({ ...base, conditionType: "interface_down" })).toBe("A monitored interface goes down");
  });

  it("does not break on a metric it does not know", () => {
    expect(ruleHeadline({ ...base, metric: "custom_metric", threshold: 5 })).toBe("custom_metric goes above 5");
  });
});

describe("ruleTiming", () => {
  it("says how often it must happen and how long it stays quiet", () => {
    expect(ruleTiming(base)).toBe("3 checks in a row to alert · 3 to clear · quiet for 5m 0s after");
  });

  it("keeps it short when there is nothing extra to say", () => {
    expect(ruleTiming({ ...base, triggerAfter: 1, clearAfter: 1, cooldownSec: 0 })).toBe("1 check in a row to alert · 1 to clear");
    expect(ruleTiming({ ...base, notifyOnRecovery: false, cooldownSec: 0 })).toContain("no recovery message");
  });
});
