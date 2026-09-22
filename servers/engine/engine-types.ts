// Shapes returned by the monitoring engine (JSON, so dates arrive as ISO strings).

export type HealthState = "UNKNOWN" | "UP" | "DEGRADED" | "DOWN" | "RECOVERING";
export type Severity = "info" | "warning" | "critical";
export type ConditionType = "metric_threshold" | "device_down" | "snmp_unavailable" | "interface_down";

export type EngineHealth = {
  status: string;
  version: string;
  uptimeSec: number;
  database: string;
  scheduler: unknown;
};

export type EnginePolling = {
  pollIntervalSec: number;
  timeoutMs: number;
  retryCount: number;
  failureThreshold: number;
  recoveryThreshold: number;
  snmpFailureThreshold: number;
  snmpRecoveryThreshold: number;
  icmpCount: number;
};

export type EngineDevice = {
  id: string;
  name: string;
  host: string;
  deviceType: string;
  vendor: string | null;
  model: string | null;
  location: string | null;
  enabled: boolean;
  icmpEnabled: boolean;
  tcpPorts: number[];
  snmpEnabled: boolean;
  snmpCredentialId: string | null;
  snmpPort: number;
  sysName: string | null;
  sysDescr: string | null;
  polling: EnginePolling;
  createdAt: string;
  updatedAt: string;
};

export type HealthSnapshot = { state: HealthState; failures: number; successes: number; since: string | null };

export type EngineDeviceStatus = {
  device: EngineDevice;
  state: {
    reachability: HealthSnapshot;
    snmp: HealthSnapshot;
    lastPollAt: string | null;
    lastPollDurationMs: number | null;
    lastSuccessAt: string | null;
    lastError: string | null;
  };
  latestMetrics: Array<{ time: string; metric: string; dimension: string | null; value: number | null; status: string; error: string | null }>;
  activeIncidents: number;
  stateHistory: Array<{ kind: string; from: string; to: string; reason: string | null; at: string }>;
};

export type EngineFleetItem = {
  deviceId: string;
  name: string;
  host: string;
  enabled: boolean;
  reachability: HealthState;
  reachabilitySince: string | null;
  snmp: HealthState;
  lastPollAt: string | null;
  lastError: string | null;
  activeIncidents: number;
  cpuPct: number | null;
  memoryPct: number | null;
  latencyMs: number | null;
};

export type EngineInterface = {
  id: string;
  ifIndex: number;
  name: string;
  alias: string | null;
  type: string | null;
  speedBps: number | null;
  adminStatus: string | null;
  operStatus: string | null;
  monitored: boolean;
  active: boolean;
  inactiveSince: string | null;
  lastOperUpAt: string | null;
  lastSeenAt: string | null;
  latest: null | {
    time: string;
    inBps: number | null;
    outBps: number | null;
    inErrors: string | null;
    outErrors: string | null;
    inDiscards: string | null;
    outDiscards: string | null;
    rateNote: string | null;
    counterBits: number | null;
  };
};

export type MetricBucket = { time: string; metric: string; dimension: string | null; avg: number | null; max: number | null; samples: number };
export type InterfaceBucket = {
  time: string;
  interfaceId: string;
  inBpsAvg: number | null;
  inBpsMax: number | null;
  outBpsAvg: number | null;
  outBpsMax: number | null;
  samples: number;
};

export type Reading = { status: string; value: number | null; error: string | null };

export type EngineTestResult = {
  host: string;
  reachable: boolean;
  latencyMs: number | null;
  icmp: null | { status: string; reachable: boolean; avgMs: number | null; packetLossPct: number | null; error: string | null };
  tcp: null | Array<{ port: number; status: string; latencyMs: number | null; error: string | null }>;
  snmp: null | {
    success: boolean;
    status: string;
    error: string | null;
    responseMs: number | null;
    system: { sysName?: string | null; sysDescr?: string | null; sysUpTimeSeconds?: number | null } | null;
    profile: string | null;
    cpu: Reading;
    memory: Reading;
    interfaces: { status: string; error: string | null; count: number };
  };
};

export type EnginePollReport = {
  deviceId: string;
  startedAt: string;
  durationMs: number;
  reachable: boolean;
  state: { reachability: HealthState; snmp: HealthState | null };
  transitions: Array<{ kind: string; from: string; to: string; reason: string }>;
  metricsWritten: number;
  interfaceSamplesWritten: number;
  errors: string[];
  snmp: null | { status?: string; error?: string | null; responseMs?: number | null; retransmits?: number; timeouts?: number; timings?: Record<string, number | null> };
};

export type EngineCredential = { id: string; name: string; type: string; keyId: string; hasSecret: true; createdAt: string; updatedAt: string };

export type EngineChannel = {
  id: string;
  name: string;
  type: "telegram" | "webhook" | "email";
  config: Record<string, unknown>;
  credentialId: string | null;
  hasCredential: boolean;
  enabled: boolean;
  implemented: boolean;
  createdAt: string;
  updatedAt: string;
};

export type EngineRule = {
  id: string;
  name: string;
  deviceId: string | null;
  conditionType: ConditionType;
  metric: string | null;
  operator: string | null;
  threshold: number | null;
  severity: Severity;
  triggerAfter: number;
  clearAfter: number;
  cooldownSec: number;
  notifyOnRecovery: boolean;
  enabled: boolean;
  channelIds: string[];
  activeIncidents?: number;
  createdAt: string;
  updatedAt: string;
};

export type EngineIncident = {
  id: string;
  ruleId: string | null;
  ruleName: string;
  deviceId: string;
  interfaceId: string | null;
  severity: Severity;
  status: "OPEN" | "ACKNOWLEDGED" | "RESOLVED";
  title: string;
  metric: string | null;
  value: number | null;
  threshold: number | null;
  error: string | null;
  triggeredAt: string;
  acknowledgedAt: string | null;
  acknowledgedBy: string | null;
  resolvedAt: string | null;
  resolutionReason: string | null;
  lastSeenAt: string;
};

export type DeliverySummary = {
  channelId: string | null;
  channelType: string;
  event: "triggered" | "recovered";
  phase: "REQUESTED" | "SENT" | "RETRYING" | "FAILED";
  attempts: number;
  lastError: string | null;
  lastErrorCode: string | null;
  sentAt: string | null;
  nextAttemptAt: string | null;
};

export type EngineIncidentDetail = { incident: EngineIncident; notifications: unknown[]; deliverySummary: DeliverySummary[] };
