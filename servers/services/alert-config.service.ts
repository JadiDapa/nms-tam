import { LIMITS } from "@/lib/config";
import { AppError } from "@/lib/errors";
import { engine } from "../engine/engine-client";
import { call, engineName, stripEngineName } from "../engine/engine-call";
import {
  ChannelSchema,
  CredentialSchema,
  RuleSchema,
  type ChannelInput,
  type CredentialDTO,
  type CredentialInput,
  type RuleInput,
} from "../validators/monitoring.validator";
import { AuditService } from "./audit.service";
import { DeviceService } from "./device.service";
import { ResourceService } from "./resource.service";
import { SubscriptionService } from "./subscription.service";

async function requireLive(orgId: number) {
  const ent = await SubscriptionService.getEntitlements(orgId);
  if (!ent.live) throw new AppError(ent.reason ?? "Your subscription is not active.");
}

const clean = <T extends Record<string, unknown>>(o: T) =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== ""));

function buildSecret(d: CredentialDTO): Record<string, unknown> {
  switch (d.type) {
    case "snmp_v1":
    case "snmp_v2c":
      return { community: d.community };
    case "snmp_v3":
      return clean({ username: d.username, authProtocol: d.authProtocol, authKey: d.authKey, privProtocol: d.privProtocol, privKey: d.privKey });
    case "telegram_bot":
      return { botToken: d.botToken };
    case "webhook_secret":
      return { secret: d.secret };
  }
}

export const AlertConfigService = {
  // ---- credentials (write-only: a secret can be replaced but never read back) ---------------------------------------

  async listCredentials(orgId: number) {
    const rows = await ResourceService.listByOrg(orgId, "CREDENTIAL");
    const meta = await call(orgId, () => engine.listCredentials(rows.map((r) => r.engineId)));
    const byId = new Map(meta.items.map((m) => [m.id, m]));
    return rows.map((r) => ({
      id: r.id,
      label: r.label,
      type: byId.get(r.engineId)?.type ?? "unknown",
      updatedAt: byId.get(r.engineId)?.updatedAt ?? r.createdAt.toISOString(),
    }));
  },

  async createCredential(actor: { id: number }, orgId: number, raw: CredentialInput) {
    await requireLive(orgId);
    const input = CredentialSchema.parse(raw);
    if ((await ResourceService.count(orgId, "CREDENTIAL")) >= LIMITS.credentialsPerOrg) {
      throw new AppError(`You can store up to ${LIMITS.credentialsPerOrg} credentials.`);
    }
    const created = await call(orgId, () =>
      engine.createCredential({ name: engineName(orgId, input.label), type: input.type, secret: buildSecret(input) }),
    );
    const record = await ResourceService.add(orgId, "CREDENTIAL", created.id, input.label).catch(async (err) => {
      await engine.deleteCredential(created.id).catch(() => undefined);
      throw err;
    });
    await AuditService.log({ actorId: actor.id, orgId, action: "credential.create", targetType: "Credential", targetId: record.id, metadata: { label: input.label, type: input.type } });
    return record.id;
  },

  async rotateCredential(actor: { id: number }, orgId: number, id: number, raw: CredentialInput) {
    await requireLive(orgId);
    const record = await ResourceService.getOwned(orgId, "CREDENTIAL", id);
    const input = CredentialSchema.parse(raw);
    await call(orgId, () => engine.rotateCredential(record.engineId, buildSecret(input)));
    await AuditService.log({ actorId: actor.id, orgId, action: "credential.rotate", targetType: "Credential", targetId: id });
  },

  async deleteCredential(actor: { id: number }, orgId: number, id: number) {
    const record = await ResourceService.getOwned(orgId, "CREDENTIAL", id);
    await call(orgId, () => engine.deleteCredential(record.engineId));
    await ResourceService.remove(id);
    await AuditService.log({ actorId: actor.id, orgId, action: "credential.delete", targetType: "Credential", targetId: id });
  },

  // ---- notification channels ---------------------------------------------------------------------------------------

  async listChannels(orgId: number) {
    const rows = await ResourceService.listByOrg(orgId, "CHANNEL");
    const creds = await ResourceService.listByOrg(orgId, "CREDENTIAL");
    const meta = await call(orgId, () => engine.listChannels(rows.map((r) => r.engineId)));
    const byId = new Map(meta.items.map((m) => [m.id, m]));
    const credByEngine = new Map(creds.map((c) => [c.engineId, c]));
    return rows.map((r) => {
      const m = byId.get(r.engineId);
      const cred = m?.credentialId ? credByEngine.get(m.credentialId) : undefined;
      return {
        id: r.id,
        label: r.label,
        type: m?.type ?? "unknown",
        enabled: m?.enabled ?? false,
        target: m ? String((m.config.chatId ?? m.config.url ?? "") as string) : "",
        credentialId: cred?.id ?? null,
        credentialLabel: cred?.label ?? null,
      };
    });
  },

  async createChannel(actor: { id: number }, orgId: number, raw: ChannelInput) {
    await requireLive(orgId);
    const input = ChannelSchema.parse(raw);
    if ((await ResourceService.count(orgId, "CHANNEL")) >= LIMITS.channelsPerOrg) {
      throw new AppError(`You can create up to ${LIMITS.channelsPerOrg} channels.`);
    }
    const credential = input.credentialId ? await ResourceService.getOwned(orgId, "CREDENTIAL", input.credentialId) : null;
    const created = await call(orgId, () =>
      engine.createChannel({
        name: engineName(orgId, input.label),
        type: input.type,
        config: input.type === "telegram" ? { chatId: input.chatId } : { url: input.url },
        credentialId: credential?.engineId ?? null,
        enabled: input.enabled,
      }),
    );
    const record = await ResourceService.add(orgId, "CHANNEL", created.id, input.label).catch(async (err) => {
      await engine.deleteChannel(created.id).catch(() => undefined);
      throw err;
    });
    await AuditService.log({ actorId: actor.id, orgId, action: "channel.create", targetType: "Channel", targetId: record.id, metadata: { label: input.label, type: input.type } });
    return record.id;
  },

  async setChannelEnabled(actor: { id: number }, orgId: number, id: number, enabled: boolean) {
    await requireLive(orgId);
    const record = await ResourceService.getOwned(orgId, "CHANNEL", id);
    await call(orgId, () => engine.updateChannel(record.engineId, { enabled }));
    await AuditService.log({ actorId: actor.id, orgId, action: "channel.update", targetType: "Channel", targetId: id, metadata: { enabled } });
  },

  async testChannel(orgId: number, id: number) {
    await requireLive(orgId);
    const record = await ResourceService.getOwned(orgId, "CHANNEL", id);
    return await call(orgId, () => engine.testChannel(record.engineId));
  },

  async deleteChannel(actor: { id: number }, orgId: number, id: number) {
    const record = await ResourceService.getOwned(orgId, "CHANNEL", id);
    await call(orgId, () => engine.deleteChannel(record.engineId));
    await ResourceService.remove(id);
    await AuditService.log({ actorId: actor.id, orgId, action: "channel.delete", targetType: "Channel", targetId: id });
  },

  // ---- alert rules -------------------------------------------------------------------------------------------------
  // A client's rule always targets one of THEIR devices. The engine can hold a rule for "every device", which would
  // fire on other clients' devices, so that shape is never created; "all my devices" becomes one rule per device.

  async listRules(orgId: number) {
    const rows = await ResourceService.listByOrg(orgId, "ALERT_RULE");
    const [devices, channels] = await Promise.all([DeviceService.listByOrg(orgId), ResourceService.listByOrg(orgId, "CHANNEL")]);
    const meta = await call(orgId, () => engine.listRules(rows.map((r) => r.engineId)));
    const byId = new Map(meta.items.map((m) => [m.id, m]));
    const deviceByEngine = new Map(devices.filter((d) => d.engineDeviceId).map((d) => [d.engineDeviceId!, d]));
    const channelByEngine = new Map(channels.map((c) => [c.engineId, c]));
    return rows
      .map((r) => {
        const m = byId.get(r.engineId);
        if (!m) return null;
        return {
          id: r.id,
          rule: m,
          device: m.deviceId ? (deviceByEngine.get(m.deviceId) ?? null) : null,
          channels: m.channelIds.map((c) => channelByEngine.get(c)).filter((c) => c !== undefined),
        };
      })
      .filter((x) => x !== null);
  },

  async getRule(orgId: number, id: number) {
    const record = await ResourceService.getOwned(orgId, "ALERT_RULE", id);
    const [rule, devices, channels] = await Promise.all([
      call(orgId, () => engine.getRule(record.engineId)),
      DeviceService.listByOrg(orgId),
      ResourceService.listByOrg(orgId, "CHANNEL"),
    ]);
    const device = devices.find((d) => d.engineDeviceId === rule.deviceId) ?? null;
    return {
      id: record.id,
      rule,
      device,
      channelIds: channels.filter((c) => rule.channelIds.includes(c.engineId)).map((c) => c.id),
    };
  },

  async createRules(actor: { id: number }, orgId: number, raw: RuleInput) {
    await requireLive(orgId);
    const input = RuleSchema.parse(raw);

    const channels = await Promise.all(input.channelIds.map((cid) => ResourceService.getOwned(orgId, "CHANNEL", cid)));
    const allDevices = (await DeviceService.listByOrg(orgId)).filter((d) => d.engineDeviceId);
    const targets =
      input.deviceId === "all" ? allDevices : [await DeviceService.getOwned(orgId, input.deviceId)];
    if (targets.length === 0) throw new AppError("Add a device first.");
    if (targets.some((t) => !t.engineDeviceId)) throw new AppError("This device is still being created.");

    const existing = await ResourceService.count(orgId, "ALERT_RULE");
    if (existing + targets.length > LIMITS.alertRulesPerOrg) {
      throw new AppError(`This would exceed the limit of ${LIMITS.alertRulesPerOrg} alert rules.`);
    }

    let created = 0;
    for (const device of targets) {
      const rule = await call(orgId, () =>
        engine.createRule({
          name: input.deviceId === "all" ? `${input.name} · ${device.name}` : input.name,
          deviceId: device.engineDeviceId,
          conditionType: input.conditionType,
          ...(input.conditionType === "metric_threshold"
            ? { metric: input.metric, operator: input.operator, threshold: input.threshold }
            : {}),
          severity: input.severity,
          triggerAfter: input.triggerAfter,
          clearAfter: input.clearAfter,
          cooldownSec: input.cooldownSec,
          notifyOnRecovery: input.notifyOnRecovery,
          enabled: input.enabled,
          channelIds: channels.map((c) => c.engineId),
        }),
      );
      await ResourceService.add(orgId, "ALERT_RULE", rule.id, rule.name).catch(async (err) => {
        await engine.deleteRule(rule.id).catch(() => undefined);
        throw err;
      });
      created++;
    }
    await AuditService.log({ actorId: actor.id, orgId, action: "rule.create", targetType: "Rule", metadata: { name: input.name, count: created } });
    return created;
  },

  async updateRule(actor: { id: number }, orgId: number, id: number, raw: RuleInput) {
    await requireLive(orgId);
    const record = await ResourceService.getOwned(orgId, "ALERT_RULE", id);
    const input = RuleSchema.parse(raw);
    const channels = await Promise.all(input.channelIds.map((cid) => ResourceService.getOwned(orgId, "CHANNEL", cid)));
    await call(orgId, () =>
      engine.updateRule(record.engineId, {
        name: input.name,
        conditionType: input.conditionType,
        ...(input.conditionType === "metric_threshold"
          ? { metric: input.metric, operator: input.operator, threshold: input.threshold }
          : {}),
        severity: input.severity,
        triggerAfter: input.triggerAfter,
        clearAfter: input.clearAfter,
        cooldownSec: input.cooldownSec,
        notifyOnRecovery: input.notifyOnRecovery,
        enabled: input.enabled,
        channelIds: channels.map((c) => c.engineId),
      }),
    );
    await ResourceService.setLabel(id, input.name);
    await AuditService.log({ actorId: actor.id, orgId, action: "rule.update", targetType: "Rule", targetId: id });
  },

  async setRuleEnabled(actor: { id: number }, orgId: number, id: number, enabled: boolean) {
    await requireLive(orgId);
    const record = await ResourceService.getOwned(orgId, "ALERT_RULE", id);
    await call(orgId, () => engine.updateRule(record.engineId, { enabled }));
    await AuditService.log({ actorId: actor.id, orgId, action: "rule.update", targetType: "Rule", targetId: id, metadata: { enabled } });
  },

  async deleteRule(actor: { id: number }, orgId: number, id: number) {
    const record = await ResourceService.getOwned(orgId, "ALERT_RULE", id);
    await call(orgId, () => engine.deleteRule(record.engineId));
    await ResourceService.remove(id);
    await AuditService.log({ actorId: actor.id, orgId, action: "rule.delete", targetType: "Rule", targetId: id });
  },
};

export { stripEngineName };
