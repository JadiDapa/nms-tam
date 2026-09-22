// Dumps the current database into prisma/seed-data.json, in FK-safe order, so it can be replayed
// by `npm run seed` (or `npx prisma db seed`) to recreate the same data on another database.
//
//   npm run seed:export
//
// Only the app's own tables are dumped (the engine owns its own database, seeded separately by
// nms-monitoring). Passwords/secrets never live in this schema, so nothing here needs redacting.
import "dotenv/config";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/prisma";

const OUT = path.resolve("prisma/seed-data.json");

async function main() {
  const data = {
    organizations: await prisma.organization.findMany({ orderBy: { id: "asc" } }),
    users: await prisma.user.findMany({ orderBy: { id: "asc" } }),
    plans: await prisma.plan.findMany({ orderBy: { id: "asc" } }),
    subscriptions: await prisma.subscription.findMany({ orderBy: { id: "asc" } }),
    payments: await prisma.payment.findMany({ orderBy: { id: "asc" } }),
    receiptSequences: await prisma.receiptSequence.findMany({ orderBy: { year: "asc" } }),
    billingRequests: await prisma.billingRequest.findMany({ orderBy: { id: "asc" } }),
    devices: await prisma.device.findMany({ orderBy: { id: "asc" } }),
    engineResources: await prisma.engineResource.findMany({ orderBy: { id: "asc" } }),
    auditLogs: await prisma.auditLog.findMany({ orderBy: { id: "asc" } }),
    incidentAnalyses: await prisma.incidentAnalysis.findMany({ orderBy: { id: "asc" } }),
  };

  writeFileSync(OUT, JSON.stringify(data, null, 2));
  const counts = Object.entries(data).map(([k, v]) => `${k}: ${v.length}`).join(", ");
  console.log(`Wrote ${OUT}\n${counts}`);
}

main()
  .catch((e) => {
    console.error(String(e?.message ?? e));
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
