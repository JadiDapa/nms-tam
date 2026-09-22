import "dotenv/config";
import { prisma } from "@/lib/prisma";
import { DeviceMonitorService } from "@/servers/services/device-monitor.service";
import { DeviceService } from "@/servers/services/device.service";
import { SubscriptionService } from "@/servers/services/subscription.service";

// The only background job of the web app. Every few minutes it
//   1. marks subscriptions whose paid period ended as EXPIRED,
//   2. pauses the devices of clients that are not paid up, and resumes the ones we paused once they are (safe to repeat),
//   3. frees slots reserved by a "create device" that never finished.
// Run it next to the web app:  npm run worker
const INTERVAL_MS = Number(process.env.WORKER_INTERVAL_SEC ?? 300) * 1000;

const log = (message: string, extra?: Record<string, unknown>) =>
  console.log(JSON.stringify({ time: new Date().toISOString(), message, ...extra }));

let running = false;

async function tick() {
  if (running) return;
  running = true;
  try {
    const expired = await SubscriptionService.markExpired();
    const stale = await DeviceService.purgeStalePending();

    let changed = 0;
    let failed = 0;
    const orgs = await prisma.organization.findMany({ select: { id: true } });
    for (const org of orgs) {
      const r = await DeviceMonitorService.syncOrgDevices(org.id);
      changed += r.changed;
      failed += r.failed;
    }
    log("tick", { expiredSubscriptions: expired, staleReservations: stale, devicesChanged: changed, devicesFailed: failed });
  } catch (err) {
    log("tick failed", { error: err instanceof Error ? err.message : String(err) });
  } finally {
    running = false;
  }
}

const timer = setInterval(tick, INTERVAL_MS);
void tick();
log("worker started", { everySeconds: INTERVAL_MS / 1000 });

async function shutdown(signal: string) {
  log("worker stopping", { signal });
  clearInterval(timer);
  while (running) await new Promise((r) => setTimeout(r, 100));
  await prisma.$disconnect();
  process.exit(0);
}

for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"] as const) process.on(signal, () => void shutdown(signal));
