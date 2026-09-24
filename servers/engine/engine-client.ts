import { config } from "@/lib/config";
import type {
  EngineChannel,
  EngineCredential,
  EngineDevice,
  EngineDeviceStatus,
  EngineFleetItem,
  EngineHealth,
  EngineIncident,
  EngineIncidentDetail,
  EngineInterface,
  EnginePollReport,
  EngineRule,
  EngineTestResult,
  MetricBucket,
  InterfaceBucket,
  SimulateRequestBody,
  SimulateResult,
} from "./engine-types";

export class EngineError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = "EngineError";
  }
}

type Query = Record<string, string | number | boolean | string[] | undefined>;

async function request<T>(
  method: string,
  path: string,
  opts: { query?: Query; body?: unknown; timeoutMs?: number } = {},
): Promise<T> {
  const url = new URL(config.engineUrl + path);
  for (const [k, v] of Object.entries(opts.query ?? {})) {
    if (v === undefined) continue;
    url.searchParams.set(k, Array.isArray(v) ? v.join(",") : String(v));
  }

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: {
        authorization: `Bearer ${config.engineApiKey}`,
        ...(opts.body !== undefined ? { "content-type": "application/json" } : {}),
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: AbortSignal.timeout(opts.timeoutMs ?? 15_000),
      cache: "no-store",
    });
  } catch {
    throw new EngineError("Monitoring engine is unreachable", 503, "ENGINE_UNREACHABLE");
  }

  if (res.status === 204) return undefined as T;
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    // not JSON (proxy error page etc.)
  }
  if (!res.ok) {
    const e = (json as { error?: { code?: string; message?: string; details?: unknown } } | null)?.error;
    throw new EngineError(e?.message ?? `Engine returned ${res.status}`, res.status, e?.code ?? "ENGINE_ERROR", e?.details);
  }
  return json as T;
}

// The lists take explicit id lists: the web app knows which objects belong to a client and asks for exactly those.
// An empty list is answered here without calling the engine (the engine would also return nothing).
const emptyList = { items: [] as never[], total: 0 };

export const engine = {
  health: () => request<EngineHealth>("GET", "/health", { timeoutMs: 5_000 }),

  // devices
  testDevice: (body: unknown) => request<EngineTestResult>("POST", "/devices/test", { body, timeoutMs: 45_000 }),
  createDevice: (body: unknown) => request<EngineDevice>("POST", "/devices", { body }),
  listDevices: (ids?: string[]) =>
    ids && ids.length === 0
      ? Promise.resolve(emptyList as { items: EngineDevice[]; total: number })
      : request<{ items: EngineDevice[]; total: number }>("GET", "/devices", { query: { ids, limit: 1000 } }),
  getDevice: (id: string) => request<EngineDevice>("GET", `/devices/${id}`),
  updateDevice: (id: string, body: unknown) => request<EngineDevice>("PATCH", `/devices/${id}`, { body }),
  deleteDevice: (id: string) => request<void>("DELETE", `/devices/${id}`),
  deviceStatus: (id: string) => request<EngineDeviceStatus>("GET", `/devices/${id}/status`),
  testStoredDevice: (id: string) => request<EngineTestResult>("POST", `/devices/${id}/test`, { timeoutMs: 45_000 }),
  pollDevice: (id: string) => request<EnginePollReport>("POST", `/devices/${id}/poll`, { timeoutMs: 60_000 }),
  fleet: (ids?: string[]) =>
    ids && ids.length === 0
      ? Promise.resolve({ items: [] as EngineFleetItem[], count: 0 })
      : request<{ items: EngineFleetItem[]; count: number }>("GET", "/fleet", { query: { ids } }),
  metrics: (id: string, q: { metric?: string; from?: Date; to?: Date; bucketSec: number; limit?: number }) =>
    request<{ items: MetricBucket[] }>("GET", `/devices/${id}/metrics`, {
      query: { metric: q.metric, from: q.from?.toISOString(), to: q.to?.toISOString(), bucketSec: q.bucketSec, limit: q.limit, order: "asc" },
    }),
  interfaces: (id: string) => request<{ items: EngineInterface[] }>("GET", `/devices/${id}/interfaces`),
  interfaceMetrics: (id: string, interfaceId: string, q: { from?: Date; to?: Date; bucketSec: number }) =>
    request<{ items: InterfaceBucket[] }>("GET", `/devices/${id}/interfaces/${interfaceId}/metrics`, {
      query: { from: q.from?.toISOString(), to: q.to?.toISOString(), bucketSec: q.bucketSec, order: "asc" },
    }),
  setInterfaceMonitored: (id: string, interfaceId: string, monitored: boolean) =>
    request<{ id: string; monitored: boolean }>("PATCH", `/devices/${id}/interfaces/${interfaceId}`, { body: { monitored } }),

  // credentials (write-only: the engine never returns a secret)
  createCredential: (body: unknown) => request<EngineCredential>("POST", "/credentials", { body }),
  listCredentials: (ids?: string[]) =>
    ids && ids.length === 0
      ? Promise.resolve({ items: [] as EngineCredential[] })
      : request<{ items: EngineCredential[] }>("GET", "/credentials", { query: { ids } }),
  rotateCredential: (id: string, secret: unknown) => request<EngineCredential>("PUT", `/credentials/${id}/secret`, { body: { secret } }),
  deleteCredential: (id: string) => request<void>("DELETE", `/credentials/${id}`),

  // channels
  createChannel: (body: unknown) => request<EngineChannel>("POST", "/channels", { body }),
  listChannels: (ids?: string[]) =>
    ids && ids.length === 0
      ? Promise.resolve({ items: [] as EngineChannel[] })
      : request<{ items: EngineChannel[] }>("GET", "/channels", { query: { ids } }),
  updateChannel: (id: string, body: unknown) => request<EngineChannel>("PATCH", `/channels/${id}`, { body }),
  deleteChannel: (id: string) => request<void>("DELETE", `/channels/${id}`),
  testChannel: (id: string) =>
    request<{ delivered: boolean; outcome: { kind: string; error?: string; message?: string } }>("POST", `/channels/${id}/test`, { timeoutMs: 30_000 }),

  // alert rules
  createRule: (body: unknown) => request<EngineRule>("POST", "/alerts", { body }),
  listRules: (ids?: string[]) =>
    ids && ids.length === 0
      ? Promise.resolve({ items: [] as EngineRule[] })
      : request<{ items: EngineRule[] }>("GET", "/alerts", { query: { ids } }),
  getRule: (id: string) => request<EngineRule>("GET", `/alerts/${id}`),
  updateRule: (id: string, body: unknown) => request<EngineRule>("PATCH", `/alerts/${id}`, { body }),
  deleteRule: (id: string) => request<void>("DELETE", `/alerts/${id}`),

  // incidents
  listIncidents: (q: { deviceIds: string[]; status?: string; severity?: string; limit?: number; offset?: number }) =>
    q.deviceIds.length === 0
      ? Promise.resolve({ items: [] as EngineIncident[], total: 0 })
      : request<{ items: EngineIncident[]; total: number }>("GET", "/incidents", {
          query: { deviceIds: q.deviceIds, status: q.status, severity: q.severity, limit: q.limit ?? 100, offset: q.offset },
        }),
  getIncident: (id: string) => request<EngineIncidentDetail>("GET", `/incidents/${id}`),
  acknowledgeIncident: (id: string, by: string) => request<EngineIncident>("POST", `/incidents/${id}/acknowledge`, { body: { by } }),

  // admin
  simulate: (body: SimulateRequestBody) => request<SimulateResult>("POST", "/admin/simulate", { body, timeoutMs: 120_000 }),
};
