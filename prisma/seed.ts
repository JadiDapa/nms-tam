// Replays prisma/seed-data.json (produced by `npm run seed:export`) onto the current database.
// Rows are upserted by their natural id, in FK-safe order, so this is safe to re-run.
//
//   npm run seed
//   npx prisma migrate reset      also runs this, via the "prisma.seed" entry in package.json
import "dotenv/config";
import { readFileSync } from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/prisma";

const FILE = path.resolve("prisma/seed-data.json");

async function main() {
  const raw = readFileSync(FILE, "utf8");
  const data = JSON.parse(raw, (key, value) => {
    // ISO date strings round-trip through JSON.stringify(Date) as strings; Prisma needs Date objects back.
    if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) return new Date(value);
    return value;
  });

  for (const row of data.organizations) await prisma.organization.upsert({ where: { id: row.id }, create: row, update: row });
  for (const row of data.users) await prisma.user.upsert({ where: { id: row.id }, create: row, update: row });
  for (const row of data.plans) await prisma.plan.upsert({ where: { id: row.id }, create: row, update: row });
  for (const row of data.subscriptions) await prisma.subscription.upsert({ where: { id: row.id }, create: row, update: row });
  for (const row of data.payments) await prisma.payment.upsert({ where: { id: row.id }, create: row, update: row });
  for (const row of data.receiptSequences) await prisma.receiptSequence.upsert({ where: { year: row.year }, create: row, update: row });
  for (const row of data.billingRequests) await prisma.billingRequest.upsert({ where: { id: row.id }, create: row, update: row });
  for (const row of data.devices) await prisma.device.upsert({ where: { id: row.id }, create: row, update: row });
  for (const row of data.engineResources) await prisma.engineResource.upsert({ where: { id: row.id }, create: row, update: row });
  for (const row of data.auditLogs) await prisma.auditLog.upsert({ where: { id: row.id }, create: row, update: row });
  for (const row of data.incidentAnalyses) await prisma.incidentAnalysis.upsert({ where: { id: row.id }, create: row, update: row });

  // rows were inserted with explicit ids, so the autoincrement sequences need to be moved past them
  const tables = ["Organization", "User", "Plan", "Subscription", "Payment", "BillingRequest", "Device", "EngineResource", "AuditLog", "IncidentAnalysis"];
  for (const table of tables) {
    await prisma.$executeRawUnsafe(
      `select setval(pg_get_serial_sequence('"${table}"', 'id'), coalesce((select max(id) from "${table}"), 1), (select max(id) from "${table}") is not null)`,
    );
  }

  const counts = Object.entries(data).map(([k, v]) => `${k}: ${(v as unknown[]).length}`).join(", ");
  console.log(`Seeded from ${FILE}\n${counts}`);
}

main()
  .catch((e) => {
    console.error(String(e?.message ?? e));
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
