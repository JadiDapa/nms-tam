// Fills the notifications and alerts pages with realistic sample data, for designing them.
//
//   npm run demo:alerts                 add sample incidents, delivery logs, alert rules and channels
//   npm run demo:alerts -- --remove     take every one of them out again
//   npm run demo:alerts -- --org 12     pick the client (the default is the only client that has devices)
//
// Development only: it writes straight into the monitoring engine's tables, so it refuses to run unless that
// database is on this machine. Nothing it adds can send a message: deliveries are written in their final state
// (the one "retrying" row is scheduled a month ahead), the sample channels point at ".invalid" addresses, and the
// sample incidents belong to no rule, so the engine never touches them.
import "dotenv/config";
import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parse } from "dotenv";
import pg from "pg";
import { prisma } from "@/lib/prisma";

const MANIFEST = path.resolve("scripts/.demo-alerts.json");
const MARK = "demo:"; // every sample incident has a subject_key starting with this
const DAY = 86_400_000;
const args = process.argv.slice(2);
const orgArg = args.includes("--org") ? Number(args[args.indexOf("--org") + 1]) : null;

// ---- the engine database (a plain connection to the tables the engine owns) ---------------------------------------

function connectEngine() {
  const envFile = path.resolve(process.cwd(), "../nms-monitoring/.env");
  if (!existsSync(envFile)) throw new Error(`Cannot find the engine settings at ${envFile}`);
  const env = parse(readFileSync(envFile));
  const url = env.DATABASE_URL;
  const schema = env.DATABASE_SCHEMA;
  if (!url || !schema) throw new Error("The engine .env has no DATABASE_URL / DATABASE_SCHEMA");
  const host = new URL(url).hostname;
  if (!["localhost", "127.0.0.1", "::1", "[::1]"].includes(host)) {
    throw new Error(`Refusing to write sample data into a database on "${host}". This script is for local development only.`);
  }
  if (process.env.NODE_ENV === "production") throw new Error("Not in production.");
  return new pg.Pool({ connectionString: url, max: 2, options: `-c search_path=${schema},public` });
}

// ---- deterministic randomness, so a re-seed looks the same ---------------------------------------------------------

function rng(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---- what to add -------------------------------------------------------------------------------------------------

const CHANNELS = [
  { label: "Telegram - NOC group", type: "telegram", config: { chatId: "-1001987654321" }, enabled: true },
  { label: "Telegram - On-call", type: "telegram", config: { chatId: "-1001122334455" }, enabled: true },
  { label: "Slack bridge", type: "webhook", config: { url: "https://hooks.example.invalid/services/nms" }, enabled: true },
  { label: "PagerDuty", type: "webhook", config: { url: "https://events.example.invalid/v2/enqueue" }, enabled: false },
] as const;

type Sev = "info" | "warning" | "critical";

type RuleDef = {
  label: string;
  condition: "metric_threshold" | "device_down" | "snmp_unavailable" | "interface_down";
  metric: string | null;
  operator: string | null;
  threshold: number | null;
  severity: Sev;
  triggerAfter: number;
  clearAfter: number;
  cooldownSec: number;
  // only rules that can never fire on healthy devices are switched on, so seeding cannot start a real alert
  enabled: boolean;
  channels: number[];
  weight: number;
  // how a sample incident of this rule looks
  value?: (r: () => number) => number;
  incidentMetric: string;
  error?: string;
  interfaceLevel?: boolean;
};

const RULES: RuleDef[] = [
  { label: "High CPU", condition: "metric_threshold", metric: "cpu_pct", operator: ">", threshold: 90, severity: "critical", triggerAfter: 3, clearAfter: 3, cooldownSec: 300, enabled: true, channels: [0, 1, 2], weight: 5, value: (r) => 91 + r() * 8, incidentMetric: "cpu_pct" },
  { label: "High memory", condition: "metric_threshold", metric: "memory_pct", operator: ">", threshold: 90, severity: "warning", triggerAfter: 3, clearAfter: 3, cooldownSec: 300, enabled: true, channels: [0, 2], weight: 4, value: (r) => 91 + r() * 6, incidentMetric: "memory_pct" },
  { label: "High latency", condition: "metric_threshold", metric: "icmp_latency_ms", operator: ">", threshold: 500, severity: "warning", triggerAfter: 3, clearAfter: 2, cooldownSec: 120, enabled: true, channels: [0], weight: 5, value: (r) => 510 + r() * 900, incidentMetric: "icmp_latency_ms" },
  { label: "Packet loss", condition: "metric_threshold", metric: "icmp_packet_loss_pct", operator: ">", threshold: 5, severity: "critical", triggerAfter: 3, clearAfter: 3, cooldownSec: 300, enabled: false, channels: [0, 1], weight: 4, value: (r) => 8 + r() * 50, incidentMetric: "icmp_packet_loss_pct" },
  { label: "Latency notice", condition: "metric_threshold", metric: "icmp_latency_ms", operator: ">", threshold: 100, severity: "info", triggerAfter: 5, clearAfter: 3, cooldownSec: 600, enabled: false, channels: [0], weight: 5, value: (r) => 105 + r() * 300, incidentMetric: "icmp_latency_ms" },
  { label: "Device unreachable", condition: "device_down", metric: null, operator: null, threshold: null, severity: "critical", triggerAfter: 2, clearAfter: 2, cooldownSec: 0, enabled: false, channels: [0, 1, 2, 3], weight: 3, incidentMetric: "reachability", error: "No reply to ICMP echo: 5 of 5 probes lost" },
  { label: "SNMP unavailable", condition: "snmp_unavailable", metric: null, operator: null, threshold: null, severity: "warning", triggerAfter: 2, clearAfter: 2, cooldownSec: 0, enabled: false, channels: [0], weight: 3, incidentMetric: "snmp", error: "SNMP request timed out after 3000 ms (2 retries)" },
  { label: "Interface down", condition: "interface_down", metric: null, operator: null, threshold: null, severity: "warning", triggerAfter: 2, clearAfter: 2, cooldownSec: 60, enabled: false, channels: [0, 2], weight: 4, incidentMetric: "if_oper_status", interfaceLevel: true },
];

const ERRORS = {
  telegram: [
    { code: "HTTP_429", status: 429, text: "Too Many Requests: retry after 12" },
    { code: "HTTP_400", status: 400, text: "Bad Request: chat not found" },
  ],
  webhook: [
    { code: "HTTP_500", status: 500, text: "Internal Server Error" },
    { code: "TIMEOUT", status: null, text: "Request timed out after 5000 ms" },
    { code: "DNS_ERROR", status: null, text: "getaddrinfo ENOTFOUND hooks.example.invalid" },
  ],
} as const;

// ---- remove ------------------------------------------------------------------------------------------------------

async function remove(engine: pg.Pool) {
  const manifest = existsSync(MANIFEST) ? (JSON.parse(readFileSync(MANIFEST, "utf8")) as { ruleIds: string[]; channelIds: string[] }) : null;
  const inc = await engine.query(`delete from incidents where subject_key like $1`, [`${MARK}%`]); // deliveries go with them
  const channelIds = manifest?.channelIds ?? (await engine.query(`select id from notification_channels where config->>'demo' = 'true'`)).rows.map((r) => r.id as string);
  const ruleIds = manifest?.ruleIds ?? [];
  if (ruleIds.length) await engine.query(`delete from alert_rules where id = any($1::uuid[])`, [ruleIds]);
  if (channelIds.length) await engine.query(`delete from notification_channels where id = any($1::uuid[])`, [channelIds]);
  const mirror = await prisma.engineResource.deleteMany({ where: { engineId: { in: [...ruleIds, ...channelIds] } } });
  if (existsSync(MANIFEST)) unlinkSync(MANIFEST);
  if (!manifest) console.log("(no manifest found: removed incidents and channels by their marks; any sample rules must be deleted in the app)");
  console.log(`Removed ${inc.rowCount} incidents, ${ruleIds.length} rules, ${channelIds.length} channels, ${mirror.count} ownership rows.`);
}

// ---- seed --------------------------------------------------------------------------------------------------------

async function seed(engine: pg.Pool) {
  if (existsSync(MANIFEST) || (await engine.query(`select 1 from incidents where subject_key like $1 limit 1`, [`${MARK}%`])).rowCount) {
    throw new Error("Sample data is already there. Run it with --remove first if you want a fresh set.");
  }

  // which client, and which of its devices
  const devices = await prisma.device.findMany({ where: { engineDeviceId: { not: null }, ...(orgArg ? { orgId: orgArg } : {}) }, orderBy: { id: "asc" } });
  const orgs = [...new Set(devices.map((d) => d.orgId))];
  if (orgs.length === 0) throw new Error("No client has a device yet: add a device first.");
  if (orgs.length > 1) throw new Error(`Several clients have devices (${orgs.join(", ")}). Pick one with --org <id>.`);
  const orgId = orgs[0];
  const actor = await prisma.user.findFirst({ where: { orgId, role: "USER" } });
  const engineIds = devices.map((d) => d.engineDeviceId!);
  const byEngine = new Map(devices.map((d) => [d.engineDeviceId!, d]));
  const ports = (await engine.query(`select id, device_id, name from interfaces where device_id = any($1::uuid[]) and monitored order by if_index`, [engineIds])).rows as {
    id: string;
    device_id: string;
    name: string;
  }[];

  const r = rng(20260921);
  const now = Date.now();
  const client = await engine.connect();
  const channelIds: string[] = [];
  const ruleIds: string[] = [];
  let incidentCount = 0;
  let deliveryCount = 0;

  try {
    await client.query("begin");

    for (const c of CHANNELS) {
      const res = await client.query(`insert into notification_channels (name, type, config, enabled) values ($1, $2, $3, $4) returning id`, [`o${orgId}:${c.label}`, c.type, { ...c.config, demo: true }, c.enabled]);
      channelIds.push(res.rows[0].id);
    }
    for (const rule of RULES) {
      const res = await client.query(
        `insert into alert_rules (name, device_id, condition_type, metric, operator, threshold, severity, trigger_after, clear_after, cooldown_sec, notify_on_recovery, enabled)
         values ($1, null, $2, $3, $4, $5, $6, $7, $8, $9, true, $10) returning id`,
        [`o${orgId}:${rule.label}`, rule.condition, rule.metric, rule.operator, rule.threshold, rule.severity, rule.triggerAfter, rule.clearAfter, rule.cooldownSec, rule.enabled],
      );
      ruleIds.push(res.rows[0].id);
      for (const ch of rule.channels) await client.query(`insert into alert_rule_channels (rule_id, channel_id) values ($1, $2)`, [res.rows[0].id, channelIds[ch]]);
    }

    // ---- incidents: a busy last three days and a thinner tail back to a month ago
    const N = 48;
    const ages = Array.from({ length: N }, () => (r() < 0.55 ? r() * 3 * DAY : 3 * DAY + r() * 27 * DAY)).sort((a, b) => a - b);
    const totalWeight = RULES.reduce((s, x) => s + x.weight, 0);
    const pickRule = () => {
      let x = r() * totalWeight;
      for (const rule of RULES) if ((x -= rule.weight) < 0) return rule;
      return RULES[0];
    };
    // the newest few stay active: some open, some acknowledged
    const openAt = new Set([0, 2, 3, 6, 9, 12]);
    const ackAt = new Set([1, 5, 8]);

    for (let i = 0; i < N; i++) {
      const rule = pickRule();
      const dev = devices[Math.floor(r() * devices.length)];
      const port = rule.interfaceLevel ? (() => { const mine = ports.filter((p) => p.device_id === dev.engineDeviceId); return mine[Math.floor(r() * mine.length)]; })() : undefined;
      if (rule.interfaceLevel && !port) { i--; continue; }

      const triggered = new Date(now - ages[i]);
      const status = openAt.has(i) ? "OPEN" : ackAt.has(i) ? "ACKNOWLEDGED" : "RESOLVED";
      const ackedAt = status === "ACKNOWLEDGED" ? new Date(triggered.getTime() + (2 + r() * 20) * 60_000) : null;
      let resolvedAt: Date | null = null;
      if (status === "RESOLVED") {
        let dur = 4 * 60_000 + r() * r() * 7 * 3_600_000;
        if (triggered.getTime() + dur > now - 60_000) dur = (now - triggered.getTime()) * (0.3 + r() * 0.5);
        resolvedAt = new Date(triggered.getTime() + dur);
      }
      const value = rule.value ? Math.round(rule.value(r) * 10) / 10 : null;
      const ruleName = `o${orgId}:${rule.label}`;
      const title = port ? `${ruleName}: ${dev.name} [${port.name}]` : `${ruleName}: ${dev.name}`;
      const lastSeen = resolvedAt ?? new Date(now - Math.floor(r() * 90) * 1000);

      const inc = await client.query(
        `insert into incidents (rule_id, rule_name, device_id, interface_id, subject_key, severity, status, title, metric, value, threshold, error,
                                triggered_at, acknowledged_at, acknowledged_by, resolved_at, resolution_reason, last_seen_at)
         values (null, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17) returning id`,
        [
          ruleName, dev.engineDeviceId, port?.id ?? null, `${MARK}${i}`, rule.severity, status, title, rule.incidentMetric, value, rule.threshold, rule.error ?? null,
          triggered, ackedAt, ackedAt ? (actor?.email ?? "operator@example.com") : null, resolvedAt, resolvedAt ? (port && r() < 0.15 ? "subject_removed" : "condition_cleared") : null, lastSeen,
        ],
      );
      incidentCount++;

      // ---- one delivery trail per enabled channel of the rule, for the alert and (when it ended) the recovery
      const events: { event: "triggered" | "recovered"; at: Date }[] = [{ event: "triggered", at: triggered }];
      if (resolvedAt) events.push({ event: "recovered", at: resolvedAt });
      for (const ch of rule.channels) {
        const def = CHANNELS[ch];
        if (!def.enabled) continue;
        for (const ev of events) {
          const rows = trail(r, def.type, ev.at, status !== "RESOLVED" && ev.event === "triggered" && i === 3 && ch === 0);
          for (const row of rows) {
            await client.query(
              `insert into notification_deliveries (incident_id, channel_id, channel_type, event, status, attempt, scheduled_at, attempted_at, sent_at, error_code, error, response_status, created_at)
               values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $7)`,
              [inc.rows[0].id, channelIds[ch], def.type, ev.event, row.status, row.attempt, row.scheduledAt, row.attemptedAt, row.sentAt, row.code, row.error, row.http],
            );
            deliveryCount++;
          }
        }
      }
      byEngine.get(dev.engineDeviceId!); // (kept for clarity: incidents only ever point at the client's own devices)
    }
    await client.query("commit");
  } catch (err) {
    await client.query("rollback");
    throw err;
  } finally {
    client.release();
  }

  // the app lists channels and rules through its ownership mirror
  await prisma.engineResource.createMany({
    data: [
      ...CHANNELS.map((c, i) => ({ orgId, kind: "CHANNEL" as const, engineId: channelIds[i], label: c.label })),
      ...RULES.map((x, i) => ({ orgId, kind: "ALERT_RULE" as const, engineId: ruleIds[i], label: x.label })),
    ],
  });
  writeFileSync(MANIFEST, JSON.stringify({ orgId, channelIds, ruleIds, seededAt: new Date().toISOString() }, null, 2));
  console.log(`Added for client ${orgId}: ${incidentCount} incidents (6 open, 3 acknowledged), ${deliveryCount} delivery attempts, ${RULES.length} alert rules, ${CHANNELS.length} channels.`);
}

type Attempt = { status: "SENT" | "FAILED" | "PENDING"; attempt: number; scheduledAt: Date; attemptedAt: Date | null; sentAt: Date | null; code: string | null; error: string | null; http: number | null };

// The attempts behind one notification: mostly a clean first try, sometimes a retry that worked, sometimes a channel that gave up.
function trail(r: () => number, type: "telegram" | "webhook", at: Date, allowRetrying: boolean): Attempt[] {
  const t = (s: number) => new Date(at.getTime() + s * 1000);
  const errs = ERRORS[type];
  const fail = (attempt: number, s: number): Attempt => {
    const e = errs[Math.floor(r() * errs.length)];
    return { status: "FAILED", attempt, scheduledAt: t(s), attemptedAt: t(s + 1), sentAt: null, code: e.code, error: e.text, http: e.status };
  };
  const sent = (attempt: number, s: number): Attempt => ({ status: "SENT", attempt, scheduledAt: t(s), attemptedAt: t(s + 1), sentAt: t(s + 1), code: null, error: null, http: 200 });

  if (allowRetrying) {
    return [fail(1, 1), { status: "PENDING", attempt: 2, scheduledAt: new Date(Date.now() + 30 * DAY), attemptedAt: null, sentAt: null, code: null, error: null, http: null }];
  }
  const roll = r();
  if (roll < 0.82) return [sent(1, 1 + Math.floor(r() * 3))];
  if (roll < 0.92) return [fail(1, 1), sent(2, 31)];
  return [fail(1, 1), fail(2, 31), fail(3, 151)];
}

// ---- go ----------------------------------------------------------------------------------------------------------

async function main() {
  const engine = connectEngine();
  try {
    if (args.includes("--remove")) await remove(engine);
    else await seed(engine);
  } finally {
    await engine.end();
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(String(e?.message ?? e));
  process.exit(1);
});
