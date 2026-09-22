import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";
import { engine } from "@/servers/engine/engine-client";
import { AlertConfigService } from "@/servers/services/alert-config.service";
import { DeviceMonitorService } from "@/servers/services/device-monitor.service";
import { DeviceService } from "@/servers/services/device.service";
import { IncidentService } from "@/servers/services/incident.service";
import { PaymentService } from "@/servers/services/payment.service";
import { PlanService } from "@/servers/services/plan.service";
import { SubscriptionService } from "@/servers/services/subscription.service";
import { RecordPaymentSchema } from "@/servers/validators/payment.validator";

// End-to-end check of the business rules against the REAL database and the REAL running engine.
// It creates clearly named "smoke-*" data, checks quota, billing, tenant isolation and suspension, and removes it again.
//
//   1. start the engine
//   2. ALLOW_PRIVATE_TARGETS=true (it monitors 127.0.0.1) and, for the SNMP part, a SNMP agent on udp/16161
//   3. npm run smoke
const SNMP_PORT = Number(process.env.SMOKE_SNMP_PORT ?? 0);
const SNMP_COMMUNITY = process.env.SMOKE_SNMP_COMMUNITY ?? "smoke-community";

let failures = 0;
const check = (ok: boolean, label: string, detail?: unknown) => {
  console.log(`${ok ? "  ok  " : " FAIL "} ${label}${ok || detail === undefined ? "" : `  -> ${String(detail)}`}`);
  if (!ok) failures++;
};
const rejects = async (fn: () => Promise<unknown>, pattern: RegExp, label: string) => {
  try {
    await fn();
    check(false, label, "it succeeded but should have been refused");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    check(pattern.test(message) && (err instanceof AppError || err instanceof Error), label, message);
  }
};

async function main() {
  if (process.env.ALLOW_PRIVATE_TARGETS !== "true") {
    throw new Error("Set ALLOW_PRIVATE_TARGETS=true: this check monitors 127.0.0.1.");
  }
  const health = await engine.health();
  console.log(`engine ${health.version} is ${health.status}`);

  const tag = `smoke-${Date.now()}`;
  const created = { orgs: [] as number[], plans: [] as number[], users: [] as number[] };

  // ---- setup: two clients, two plans, an admin and a user per client -------------------------------------------------
  const big = await PlanService.create({ name: `${tag}-big`, priceMonthly: 250_000, extraSlotPrice: 10_000, maxDevices: 3, maxUsers: 2, minPollIntervalSec: 5, sortOrder: 99, isActive: false });
  const small = await PlanService.create({ name: `${tag}-small`, priceMonthly: 100_000, extraSlotPrice: 12_000, maxDevices: 1, maxUsers: 1, minPollIntervalSec: 60, sortOrder: 99, isActive: false });
  created.plans.push(big.id, small.id);
  const orgA = await prisma.organization.create({ data: { name: `${tag} A` } });
  const orgB = await prisma.organization.create({ data: { name: `${tag} B` } });
  created.orgs.push(orgA.id, orgB.id);
  const admin = await prisma.user.create({ data: { email: `${tag}-admin@example.test`, role: "ADMIN", clerkId: `${tag}-c0`, name: "Smoke Admin" } });
  const userA = await prisma.user.create({ data: { email: `${tag}-a@example.test`, role: "USER", orgId: orgA.id, clerkId: `${tag}-c1`, name: "Smoke A" } });
  const userB = await prisma.user.create({ data: { email: `${tag}-b@example.test`, role: "USER", orgId: orgB.id, clerkId: `${tag}-c2`, name: "Smoke B" } });
  created.users.push(admin.id, userA.id, userB.id);

  const pay = (input: Record<string, unknown>) => PaymentService.record(RecordPaymentSchema.parse({ method: "BANK_TRANSFER", paidAt: new Date(), ...input }), admin.id);

  try {
    console.log("\n[billing] a client without a plan can do nothing");
    await rejects(() => DeviceMonitorService.create(userA, orgA.id, { name: "x", host: "127.0.0.1" }), /No subscription/i, "cannot add a device without a subscription");

    console.log("\n[billing] activation, receipts, renewal");
    const p1 = await pay({ orgId: orgA.id, kind: "ACTIVATION", planId: big.id, months: 1, amount: 250_000, reference: "TRX-1" });
    check(/^RCP-\d{4}-\d{4,}$/.test(p1.receiptNumber), "receipt number is issued", p1.receiptNumber);
    let ent = await SubscriptionService.getEntitlements(orgA.id);
    check(ent.live && ent.deviceLimit === 3 && ent.userLimit === 2, "activation makes the client live with the plan's limits", JSON.stringify(ent));
    const p2 = await pay({ orgId: orgA.id, kind: "RENEWAL", months: 2, amount: 500_000, reference: "TRX-2" });
    check(p2.coversFrom!.getTime() === p1.coversUntil!.getTime(), "a renewal extends from the current end, it does not restart", `${p2.coversFrom?.toISOString()} vs ${p1.coversUntil?.toISOString()}`);
    check(p2.receiptNumber !== p1.receiptNumber, "every payment gets its own receipt number");
    await rejects(() => pay({ orgId: orgA.id, kind: "ACTIVATION", planId: big.id, months: 1, amount: 1, reference: "dup" }), /already has a subscription/i, "a second activation is refused");
    await pay({ orgId: orgB.id, kind: "ACTIVATION", planId: small.id, months: 1, amount: 100_000, reference: "TRX-B" });

    console.log("\n[quota] slots are enforced, even under concurrency");
    const cred = SNMP_PORT
      ? await AlertConfigService.createCredential(userA, orgA.id, { label: `${tag}-snmp`, type: "snmp_v2c", community: SNMP_COMMUNITY })
      : null;
    const add = (name: string, extra: Record<string, unknown> = {}) =>
      DeviceMonitorService.create(userA, orgA.id, { name, host: "127.0.0.1", icmpEnabled: true, polling: { pollIntervalSec: 30, timeoutMs: 800, retryCount: 0 }, ...extra });

    await rejects(() => DeviceMonitorService.create(userB, orgB.id, { name: "fast", host: "127.0.0.1", polling: { pollIntervalSec: 30 } }), /at least 60 seconds/i, "polling faster than the plan allows is refused");
    check((await DeviceService.count(orgB.id)) === 0, "a refused add does not keep a slot");

    await add(`${tag}-d1`);
    const burst = await Promise.allSettled([add(`${tag}-d2`), add(`${tag}-d3`), add(`${tag}-d4`), add(`${tag}-d5`)]);
    const ok = burst.filter((r) => r.status === "fulfilled").length;
    const refused = burst.filter((r) => r.status === "rejected" && /quota reached/i.test(String((r as PromiseRejectedResult).reason?.message))).length;
    check(ok === 2 && refused === 2, "4 simultaneous adds with 2 slots left: exactly 2 succeed, 2 hit the quota", `ok=${ok} refused=${refused}`);
    check((await DeviceService.count(orgA.id)) === 3, "the client uses exactly 3 of 3 slots");
    check((await engine.listDevices()).items.filter((d) => d.name.startsWith(tag)).length === 3, "the engine holds exactly those 3 devices (a refused add leaves nothing behind)");

    console.log("\n[billing] extra slots");
    await pay({ orgId: orgA.id, kind: "EXTRA_SLOTS", slots: 2, amount: 20_000, reference: "TRX-3" });
    ent = await SubscriptionService.getEntitlements(orgA.id);
    check(ent.deviceLimit === 5 && ent.extraSlots === 2, "2 extra slots raise the limit from 3 to 5", `limit ${ent.deviceLimit}`);
    const snmpDevice = SNMP_PORT && cred
      ? await DeviceMonitorService.create(userA, orgA.id, { name: `${tag}-snmp-dev`, host: "127.0.0.1", icmpEnabled: true, snmpEnabled: true, snmpCredentialId: cred, snmpPort: SNMP_PORT, polling: { pollIntervalSec: 30, timeoutMs: 1500, retryCount: 0 } })
      : await add(`${tag}-d6`);
    check(typeof snmpDevice === "number", "the 4th device fits after buying slots");
    await rejects(() => SubscriptionService.setExtraSlots(orgA.id, 0), /remove 1 first/i, "removing slots below current usage is refused");

    console.log("\n[monitoring] real polls, real data");
    const test = await DeviceMonitorService.test(orgA.id, { host: "127.0.0.1", icmp: true, tcpPorts: [], snmpCredentialId: cred ?? undefined, snmpPort: SNMP_PORT || 161 });
    check(test.reachable === true && test.icmp?.reachable === true, "the wizard test reaches 127.0.0.1 by real ping");
    if (SNMP_PORT) check(test.snmp?.success === true && test.snmp.system?.sysName === "smoke-router", "SNMP test returns what the agent reported", JSON.stringify(test.snmp?.error));
    const report = await DeviceMonitorService.pollNow(orgA.id, snmpDevice);
    check(report.reachable === true && report.state.reachability !== "DOWN", "poll now works", JSON.stringify(report.errors));
    const fleet = await DeviceMonitorService.fleet(orgA.id);
    const row = fleet.rows.find((r) => r.device.id === snmpDevice)!;
    check(row.fleet?.lastPollAt !== null && row.fleet !== null, "the fleet shows the polled device with a last-poll time");
    if (SNMP_PORT) {
      await DeviceMonitorService.pollNow(orgA.id, snmpDevice);
      const interfaces = await DeviceMonitorService.interfaces(orgA.id, snmpDevice);
      check(interfaces.length === 2 && interfaces.some((i) => i.name === "ether1"), "interfaces come from the device's own table", interfaces.map((i) => i.name).join(","));
      const metrics = await DeviceMonitorService.metrics(orgA.id, snmpDevice, "1h");
      check((metrics.cpu_pct?.length ?? 0) > 0 && metrics.cpu_pct![0].avg! > 0, "CPU history is bucketed real data", JSON.stringify(metrics.cpu_pct));
      const traffic = await DeviceMonitorService.interfaceTraffic(orgA.id, snmpDevice, interfaces[0].id, "1h");
      check(Array.isArray(traffic), "interface traffic can be charted");
    }

    console.log("\n[alerts] a client's rules stay on the client's own devices");
    const channelCred = await AlertConfigService.createCredential(userA, orgA.id, { label: `${tag}-hook`, type: "webhook_secret", secret: "smoke-secret-123" });
    const channel = await AlertConfigService.createChannel(userA, orgA.id, { label: `${tag}-webhook`, type: "webhook", url: "https://example.com/hook", credentialId: channelCred });
    const made = await AlertConfigService.createRules(userA, orgA.id, { name: `${tag}-down`, deviceId: "all", conditionType: "device_down", severity: "critical", channelIds: [channel] });
    check(made === 4, "'all my devices' creates one rule per device", `created ${made}`);
    const engineRules = (await engine.listRules(undefined)).items.filter((r) => r.name.startsWith(tag));
    const ownIds = new Set((await DeviceService.listByOrg(orgA.id)).map((d) => d.engineDeviceId));
    check(engineRules.length === 4 && engineRules.every((r) => r.deviceId !== null && ownIds.has(r.deviceId)), "no rule applies to every device in the engine (that would cross clients)");
    check((await AlertConfigService.listRules(orgB.id)).length === 0, "the other client sees none of them");

    console.log("\n[isolation] client B cannot reach client A's things");
    await rejects(() => DeviceMonitorService.detail(orgB.id, snmpDevice), /not found/i, "device detail of another client");
    await rejects(() => DeviceMonitorService.pollNow(orgB.id, snmpDevice), /not found/i, "polling another client's device");
    await rejects(() => DeviceMonitorService.update(userB, orgB.id, snmpDevice, { name: "hijack" }), /not found/i, "editing another client's device");
    await rejects(() => DeviceMonitorService.remove(userB, orgB.id, snmpDevice), /not found/i, "deleting another client's device");
    await rejects(() => DeviceMonitorService.interfaces(orgB.id, snmpDevice), /not found/i, "reading another client's interfaces");
    await rejects(() => AlertConfigService.deleteChannel(userB, orgB.id, channel), /not found/i, "deleting another client's channel");
    await rejects(() => AlertConfigService.rotateCredential(userB, orgB.id, cred ?? channelCred, { label: "x", type: "snmp_v2c", community: "hijack" }), /not found/i, "replacing another client's credential");
    await rejects(() => AlertConfigService.createChannel(userB, orgB.id, { label: "b-hook", type: "webhook", url: "https://example.com/x", credentialId: channelCred }), /not found/i, "using another client's credential");
    await rejects(() => DeviceMonitorService.create(userB, orgB.id, { name: "b1", host: "127.0.0.1", snmpEnabled: true, snmpCredentialId: cred ?? channelCred }), /not found/i, "using another client's credential on a device");
    const bIncidents = await IncidentService.list(orgB.id);
    check(bIncidents.total === 0, "the other client's incident list is empty");
    check((await DeviceMonitorService.fleet(orgB.id)).rows.length === 0, "the other client's fleet is empty");

    console.log("\n[billing] downgrade guard");
    await rejects(() => SubscriptionService.changePlan(orgA.id, small.id), /allows/i, "cannot switch to a plan smaller than current usage");

    console.log("\n[expiry] no grace: paused at once, resumed on payment, user pauses respected");
    const devices = await DeviceService.listByOrg(orgA.id);
    await DeviceMonitorService.setEnabled(userA, orgA.id, devices[0].id, false); // the client pauses one on their own
    await prisma.subscription.update({ where: { orgId: orgA.id }, data: { currentPeriodEnd: new Date(Date.now() - 60_000) } });
    ent = await SubscriptionService.getEntitlements(orgA.id);
    check(!ent.live && ent.status === "EXPIRED", "one minute past the paid date the client is not live", ent.status);
    await rejects(() => add(`${tag}-late`), /expired/i, "adding a device after expiry is refused");
    await rejects(() => AlertConfigService.createChannel(userA, orgA.id, { label: "late", type: "webhook", url: "https://example.com/x" }), /expired/i, "creating a channel after expiry is refused");
    const paused = await DeviceMonitorService.syncOrgDevices(orgA.id);
    const afterPause = await DeviceService.listByOrg(orgA.id);
    check(paused.changed === devices.length - 1 && afterPause.filter((d) => d.disabledBy === "SUBSCRIPTION").length === devices.length - 1, "the sync pauses the running devices", JSON.stringify(paused));
    check((await engine.getDevice(devices[1].engineDeviceId!)).enabled === false, "the engine really stopped polling them");
    await pay({ orgId: orgA.id, kind: "RENEWAL", months: 1, amount: 250_000, reference: "TRX-4" });
    const resumed = await DeviceMonitorService.syncOrgDevices(orgA.id);
    const afterResume = await DeviceService.listByOrg(orgA.id);
    check(resumed.changed === devices.length - 1, "paying resumes only the devices we paused", JSON.stringify(resumed));
    check(afterResume.find((d) => d.id === devices[0].id)?.status === "SUSPENDED" && afterResume.find((d) => d.id === devices[0].id)?.disabledBy === "USER", "the device the client paused themselves stays paused");
    check((await engine.getDevice(devices[1].engineDeviceId!)).enabled === true, "the engine polls them again");

    console.log("\n[delete] slots come back and dependent rules go");
    const before = (await AlertConfigService.listRules(orgA.id)).length;
    await DeviceMonitorService.remove(userA, orgA.id, devices[1].id);
    check((await DeviceService.count(orgA.id)) === devices.length - 1, "deleting a device frees its slot");
    check((await AlertConfigService.listRules(orgA.id)).length === before - 1, "its alert rule is gone with it");
  } finally {
    console.log("\n[cleanup]");
    for (const orgId of created.orgs) {
      for (const d of await prisma.device.findMany({ where: { orgId } })) {
        if (d.engineDeviceId) await engine.deleteDevice(d.engineDeviceId).catch(() => undefined);
      }
      for (const r of await prisma.engineResource.findMany({ where: { orgId }, orderBy: { kind: "desc" } })) {
        const del = r.kind === "ALERT_RULE" ? engine.deleteRule : r.kind === "CHANNEL" ? engine.deleteChannel : engine.deleteCredential;
        await del(r.engineId).catch(() => undefined);
      }
      await prisma.engineResource.deleteMany({ where: { orgId } });
      await prisma.device.deleteMany({ where: { orgId } });
      await prisma.billingRequest.deleteMany({ where: { orgId } });
      await prisma.payment.deleteMany({ where: { orgId } });
      await prisma.subscription.deleteMany({ where: { orgId } });
    }
    await prisma.auditLog.deleteMany({ where: { OR: [{ orgId: { in: created.orgs } }, { actorId: { in: created.users } }] } });
    await prisma.user.deleteMany({ where: { id: { in: created.users } } });
    await prisma.organization.deleteMany({ where: { id: { in: created.orgs } } });
    await prisma.plan.deleteMany({ where: { id: { in: created.plans } } });
    // do not leave the receipt counter advanced: the first real receipt must be number 0001
    if ((await prisma.payment.count()) === 0) await prisma.receiptSequence.deleteMany();
    const leftovers = (await engine.listDevices()).items.filter((d) => d.name.startsWith(tag)).length;
    check(leftovers === 0, "nothing of this check is left behind in the engine", `${leftovers} devices`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    failures++;
  })
  .finally(async () => {
    await prisma.$disconnect();
    console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
    process.exit(failures === 0 ? 0 : 1);
  });
