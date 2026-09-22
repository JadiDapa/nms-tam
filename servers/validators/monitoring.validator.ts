import { z } from "zod";

export const DEVICE_TYPES = ["router", "switch", "firewall", "server", "access_point", "gateway", "unknown"] as const;
export const CREDENTIAL_TYPES = ["snmp_v1", "snmp_v2c", "snmp_v3", "telegram_bot", "webhook_secret"] as const;
export const AUTH_PROTOCOLS = ["MD5", "SHA", "SHA224", "SHA256", "SHA384", "SHA512"] as const;
export const PRIV_PROTOCOLS = ["DES", "AES", "AES256B", "AES256R"] as const;
export const CONDITION_TYPES = ["metric_threshold", "device_down", "snmp_unavailable", "interface_down"] as const;
export const OPERATORS = [">", ">=", "<", "<=", "==", "!="] as const;
export const SEVERITIES = ["info", "warning", "critical"] as const;
export const THRESHOLD_METRICS = [
  { value: "cpu_pct", label: "CPU usage (%)" },
  { value: "memory_pct", label: "Memory usage (%)" },
  { value: "icmp_latency_ms", label: "Ping latency (ms)" },
  { value: "icmp_packet_loss_pct", label: "Packet loss (%)" },
  { value: "if_in_bps", label: "Interface inbound (bps)" },
  { value: "if_out_bps", label: "Interface outbound (bps)" },
] as const;

const hostSchema = z
  .string()
  .trim()
  .min(1, "Host is required")
  .max(253)
  .regex(/^[A-Za-z0-9._:-]+$/, "Enter an IP address or host name only (no http://, spaces or paths)");

const port = z.number().int().min(1, "Port must be 1-65535").max(65535, "Port must be 1-65535");

const PollingSchema = z
  .object({
    pollIntervalSec: z.number().int().min(5).max(86_400),
    timeoutMs: z.number().int().min(200).max(60_000),
    retryCount: z.number().int().min(0).max(5),
    failureThreshold: z.number().int().min(1).max(100),
    recoveryThreshold: z.number().int().min(1).max(100),
    snmpFailureThreshold: z.number().int().min(1).max(100),
    snmpRecoveryThreshold: z.number().int().min(1).max(100),
    icmpCount: z.number().int().min(1).max(10),
  })
  .partial();

// Fields without defaults: an update that leaves a field out must leave it alone (a default would silently reset it).
const DeviceFields = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  host: hostSchema,
  deviceType: z.enum(DEVICE_TYPES),
  location: z.string().trim().max(200).nullish(),
  // Map position (kept by this app, not sent to the engine). Both or neither.
  latitude: z.number().min(-90, "Latitude must be between -90 and 90").max(90, "Latitude must be between -90 and 90").nullish(),
  longitude: z.number().min(-180, "Longitude must be between -180 and 180").max(180, "Longitude must be between -180 and 180").nullish(),
  icmpEnabled: z.boolean(),
  tcpPorts: z.array(port).max(20),
  snmpEnabled: z.boolean(),
  // id of the client's own credential record, never an engine id
  snmpCredentialId: z.number().int().positive().nullish(),
  snmpPort: port,
  polling: PollingSchema,
});

export const locationCheck = (v: { latitude?: number | null; longitude?: number | null }, ctx: z.RefinementCtx) => {
  const hasLat = v.latitude !== undefined && v.latitude !== null;
  const hasLng = v.longitude !== undefined && v.longitude !== null;
  if (hasLat !== hasLng) {
    ctx.addIssue({ code: "custom", path: [hasLat ? "longitude" : "latitude"], message: "Set both latitude and longitude, or leave both empty" });
  }
};

const checks = (v: { latitude?: number | null; longitude?: number | null; icmpEnabled?: boolean; tcpPorts?: number[]; snmpEnabled?: boolean; snmpCredentialId?: number | null }, ctx: z.RefinementCtx) => {
  locationCheck(v, ctx);
  if (!v.icmpEnabled && !v.snmpEnabled && (v.tcpPorts?.length ?? 0) === 0) {
    ctx.addIssue({ code: "custom", path: ["icmpEnabled"], message: "Enable at least one check: ping, TCP ports or SNMP" });
  }
  if (v.snmpEnabled && !v.snmpCredentialId) {
    ctx.addIssue({ code: "custom", path: ["snmpCredentialId"], message: "Choose an SNMP credential" });
  }
};

export const CreateDeviceSchema = DeviceFields.extend({
  deviceType: DeviceFields.shape.deviceType.default("unknown"),
  icmpEnabled: DeviceFields.shape.icmpEnabled.default(true),
  tcpPorts: DeviceFields.shape.tcpPorts.default([]),
  snmpEnabled: DeviceFields.shape.snmpEnabled.default(false),
  snmpPort: DeviceFields.shape.snmpPort.default(161),
  polling: DeviceFields.shape.polling.default({}),
  enabled: z.boolean().default(true),
}).superRefine(checks);

export const UpdateDeviceSchema = DeviceFields.partial().superRefine((v, ctx) => {
  locationCheck(v, ctx);
  if (v.snmpEnabled && !v.snmpCredentialId) {
    ctx.addIssue({ code: "custom", path: ["snmpCredentialId"], message: "Choose an SNMP credential" });
  }
});

export const TestDeviceSchema = z
  .object({
    host: hostSchema,
    icmp: z.boolean().default(true),
    tcpPorts: z.array(port).max(20).default([]),
    snmpCredentialId: z.number().int().positive().nullish(),
    snmpPort: port.default(161),
  })
  .superRefine((v, ctx) => {
    if (!v.icmp && v.tcpPorts.length === 0 && !v.snmpCredentialId) {
      ctx.addIssue({ code: "custom", path: ["icmp"], message: "Enable at least one check to test" });
    }
  });

export const CredentialSchema = z
  .object({
    label: z.string().trim().min(1, "Name is required").max(100),
    type: z.enum(CREDENTIAL_TYPES),
    community: z.string().max(255).optional(),
    username: z.string().max(255).optional(),
    authProtocol: z.enum(AUTH_PROTOCOLS).optional(),
    authKey: z.string().max(255).optional(),
    privProtocol: z.enum(PRIV_PROTOCOLS).optional(),
    privKey: z.string().max(255).optional(),
    botToken: z.string().max(255).optional(),
    secret: z.string().max(255).optional(),
  })
  .superRefine((v, ctx) => {
    const need = (val: string | undefined, path: string, message: string) => {
      if (!val || val.trim() === "") ctx.addIssue({ code: "custom", path: [path], message });
    };
    if (v.type === "snmp_v1" || v.type === "snmp_v2c") need(v.community, "community", "Community string is required");
    if (v.type === "snmp_v3") {
      need(v.username, "username", "Username is required");
      if (Boolean(v.authProtocol) !== Boolean(v.authKey)) {
        ctx.addIssue({ code: "custom", path: ["authKey"], message: "Auth protocol and key go together" });
      }
      if (Boolean(v.privProtocol) !== Boolean(v.privKey)) {
        ctx.addIssue({ code: "custom", path: ["privKey"], message: "Privacy protocol and key go together" });
      }
    }
    if (v.type === "telegram_bot") need(v.botToken, "botToken", "Bot token is required");
    if (v.type === "webhook_secret") need(v.secret, "secret", "Secret is required");
  });

export type CredentialDTO = z.infer<typeof CredentialSchema>;

// A rotation replaces only the secret part, so it reuses the same per-type checks with a placeholder label.
export const RotateCredentialSchema = z.object({ credentialId: z.number().int().positive(), secretInput: CredentialSchema });

export const ChannelSchema = z
  .object({
    label: z.string().trim().min(1, "Name is required").max(100),
    type: z.enum(["telegram", "webhook"]),
    chatId: z.string().trim().max(100).optional(),
    url: z.string().trim().max(500).optional(),
    credentialId: z.number().int().positive().nullish(),
    enabled: z.boolean().default(true),
  })
  .superRefine((v, ctx) => {
    if (v.type === "telegram") {
      if (!v.chatId) ctx.addIssue({ code: "custom", path: ["chatId"], message: "Chat ID is required" });
      if (!v.credentialId) ctx.addIssue({ code: "custom", path: ["credentialId"], message: "Choose a Telegram bot credential" });
    }
    if (v.type === "webhook") {
      if (!v.url || !/^https?:\/\//i.test(v.url)) {
        ctx.addIssue({ code: "custom", path: ["url"], message: "Enter a URL starting with http:// or https://" });
      }
    }
  });

export type ChannelDTO = z.infer<typeof ChannelSchema>;

export const RuleSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(200),
    // one of the client's devices, or every device they own right now
    deviceId: z.union([z.number().int().positive(), z.literal("all")]),
    conditionType: z.enum(CONDITION_TYPES),
    metric: z.string().optional(),
    operator: z.enum(OPERATORS).optional(),
    threshold: z.number().finite().optional(),
    severity: z.enum(SEVERITIES),
    triggerAfter: z.number().int().min(1).max(1000).optional(),
    clearAfter: z.number().int().min(1).max(1000).optional(),
    cooldownSec: z.number().int().min(0).max(604_800).default(0),
    notifyOnRecovery: z.boolean().default(true),
    enabled: z.boolean().default(true),
    channelIds: z.array(z.number().int().positive()).max(50).default([]),
  })
  .superRefine((v, ctx) => {
    if (v.conditionType === "metric_threshold") {
      if (!v.metric) ctx.addIssue({ code: "custom", path: ["metric"], message: "Choose a metric" });
      if (!v.operator) ctx.addIssue({ code: "custom", path: ["operator"], message: "Choose an operator" });
      if (v.threshold === undefined) ctx.addIssue({ code: "custom", path: ["threshold"], message: "Enter a threshold" });
    }
  });

export type RuleDTO = z.infer<typeof RuleSchema>;
export type RuleInput = z.input<typeof RuleSchema>;
export type CreateDeviceInput = z.input<typeof CreateDeviceSchema>;
export type UpdateDeviceInput = z.input<typeof UpdateDeviceSchema>;
export type TestDeviceInput = z.input<typeof TestDeviceSchema>;
export type ChannelInput = z.input<typeof ChannelSchema>;
export type CredentialInput = z.input<typeof CredentialSchema>;

export const RANGES = {
  "1h": { ms: 3_600_000, bucketSec: 30, label: "1 hour" },
  "6h": { ms: 21_600_000, bucketSec: 120, label: "6 hours" },
  "24h": { ms: 86_400_000, bucketSec: 300, label: "24 hours" },
  "7d": { ms: 604_800_000, bucketSec: 1800, label: "7 days" },
} as const;
export type RangeKey = keyof typeof RANGES;
export const parseRange = (v: string | undefined): RangeKey => (v && v in RANGES ? (v as RangeKey) : "24h");
