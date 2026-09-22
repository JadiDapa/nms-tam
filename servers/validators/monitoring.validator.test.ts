import { describe, expect, it } from "vitest";
import {
  ChannelSchema,
  CreateDeviceSchema,
  CredentialSchema,
  RuleSchema,
  TestDeviceSchema,
  UpdateDeviceSchema,
} from "./monitoring.validator";

describe("device schemas", () => {
  const base = { name: "Core", host: "203.0.113.10" };

  it("create applies defaults", () => {
    const d = CreateDeviceSchema.parse(base);
    expect(d).toMatchObject({ deviceType: "unknown", icmpEnabled: true, tcpPorts: [], snmpEnabled: false, snmpPort: 161, enabled: true });
  });

  it("update leaves omitted fields alone (a default must never silently reset a setting)", () => {
    const patch = UpdateDeviceSchema.parse({ name: "Renamed" });
    expect(patch).toEqual({ name: "Renamed" });
  });

  it("needs at least one check", () => {
    const r = CreateDeviceSchema.safeParse({ ...base, icmpEnabled: false });
    expect(r.success).toBe(false);
  });

  it("SNMP needs a credential", () => {
    expect(CreateDeviceSchema.safeParse({ ...base, snmpEnabled: true }).success).toBe(false);
    expect(CreateDeviceSchema.safeParse({ ...base, snmpEnabled: true, snmpCredentialId: 3 }).success).toBe(true);
  });

  it.each(["http://1.2.3.4", "1.2.3.4/path", "host name", "a@b", ""])("rejects a host like %j", (host) => {
    expect(CreateDeviceSchema.safeParse({ ...base, host }).success).toBe(false);
  });

  it.each(["203.0.113.10", "router.example.com", "2001:db8::1"])("accepts a host like %s", (host) => {
    expect(CreateDeviceSchema.safeParse({ ...base, host }).success).toBe(true);
  });

  it("checks ports", () => {
    expect(CreateDeviceSchema.safeParse({ ...base, tcpPorts: [22, 70000] }).success).toBe(false);
    expect(CreateDeviceSchema.safeParse({ ...base, tcpPorts: [22, 443] }).success).toBe(true);
  });

  it("map position: both coordinates or neither, inside the valid range", () => {
    expect(CreateDeviceSchema.safeParse({ ...base, latitude: -2.99, longitude: 104.76 }).success).toBe(true);
    expect(CreateDeviceSchema.safeParse({ ...base, latitude: null, longitude: null }).success).toBe(true);
    expect(CreateDeviceSchema.safeParse(base).success).toBe(true);
    expect(CreateDeviceSchema.safeParse({ ...base, latitude: -2.99 }).success).toBe(false);
    expect(CreateDeviceSchema.safeParse({ ...base, longitude: 104.76 }).success).toBe(false);
    expect(CreateDeviceSchema.safeParse({ ...base, latitude: 91, longitude: 10 }).success).toBe(false);
    expect(CreateDeviceSchema.safeParse({ ...base, latitude: 10, longitude: -181 }).success).toBe(false);
    // updates: leaving both out changes nothing, sending one alone is refused, clearing needs both null
    expect(UpdateDeviceSchema.parse({ name: "x" })).toEqual({ name: "x" });
    expect(UpdateDeviceSchema.safeParse({ latitude: 1 }).success).toBe(false);
    expect(UpdateDeviceSchema.safeParse({ latitude: null, longitude: null }).success).toBe(true);
  });

  it("the test needs at least one check", () => {
    expect(TestDeviceSchema.safeParse({ host: "203.0.113.10", icmp: false }).success).toBe(false);
    expect(TestDeviceSchema.safeParse({ host: "203.0.113.10" }).success).toBe(true);
  });
});

describe("credential schema", () => {
  it("each type asks for its own secret", () => {
    expect(CredentialSchema.safeParse({ label: "a", type: "snmp_v2c" }).success).toBe(false);
    expect(CredentialSchema.safeParse({ label: "a", type: "snmp_v2c", community: "public" }).success).toBe(true);
    expect(CredentialSchema.safeParse({ label: "a", type: "telegram_bot" }).success).toBe(false);
    expect(CredentialSchema.safeParse({ label: "a", type: "webhook_secret", secret: "12345678" }).success).toBe(true);
  });

  it("SNMPv3 protocols come with their keys", () => {
    expect(CredentialSchema.safeParse({ label: "a", type: "snmp_v3", username: "u", authProtocol: "SHA" }).success).toBe(false);
    expect(CredentialSchema.safeParse({ label: "a", type: "snmp_v3", username: "u", authProtocol: "SHA", authKey: "longenough" }).success).toBe(true);
  });
});

describe("channel schema", () => {
  it("telegram needs a chat and a bot credential; webhook needs an http(s) url", () => {
    expect(ChannelSchema.safeParse({ label: "t", type: "telegram" }).success).toBe(false);
    expect(ChannelSchema.safeParse({ label: "t", type: "telegram", chatId: "-100", credentialId: 2 }).success).toBe(true);
    expect(ChannelSchema.safeParse({ label: "w", type: "webhook", url: "ftp://x" }).success).toBe(false);
    expect(ChannelSchema.safeParse({ label: "w", type: "webhook", url: "https://example.com/hook" }).success).toBe(true);
  });
});

describe("rule schema", () => {
  const base = { name: "r", deviceId: 4, severity: "critical" as const };

  it("threshold rules need metric, operator and threshold; state rules do not", () => {
    expect(RuleSchema.safeParse({ ...base, conditionType: "device_down" }).success).toBe(true);
    expect(RuleSchema.safeParse({ ...base, conditionType: "metric_threshold" }).success).toBe(false);
    expect(RuleSchema.safeParse({ ...base, conditionType: "metric_threshold", metric: "cpu_pct", operator: ">", threshold: 90 }).success).toBe(true);
  });

  it("targets one device or all of the client's own devices, never 'no device'", () => {
    expect(RuleSchema.safeParse({ ...base, conditionType: "device_down", deviceId: "all" }).success).toBe(true);
    expect(RuleSchema.safeParse({ ...base, conditionType: "device_down", deviceId: null }).success).toBe(false);
    expect(RuleSchema.safeParse({ name: "r", severity: "critical", conditionType: "device_down" }).success).toBe(false);
  });
});
