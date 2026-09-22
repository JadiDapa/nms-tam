import "dotenv/config";
import { randomBytes } from "node:crypto";
import { createClerkClient } from "@clerk/backend";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

// Creates (or repairs) the first administrator: a Clerk account plus our own record. Sign-up is invitation only,
// so the very first admin cannot invite themselves.
//
//   npm run create-admin -- you@company.com "Your Name"
//
// A password is generated and printed once. Change it after the first sign-in.
const [email, ...nameParts] = process.argv.slice(2);
const name = nameParts.join(" ").trim() || "Administrator";

if (!email || !email.includes("@")) {
  console.error('Usage: npm run create-admin -- you@company.com "Your Name"');
  process.exit(1);
}

const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

async function main() {
  const normalized = email.toLowerCase();

  const existing = await clerk.users.getUserList({ emailAddress: [normalized] });
  let clerkUser = existing.data[0];
  let password: string | null = null;

  if (!clerkUser) {
    password = randomBytes(15).toString("base64url");
    clerkUser = await clerk.users.createUser({
      emailAddress: [normalized],
      password,
      firstName: name.split(" ")[0],
      lastName: name.split(" ").slice(1).join(" ") || undefined,
    });
  }

  const user = await prisma.user.upsert({
    where: { email: normalized },
    create: { email: normalized, name, role: "ADMIN", clerkId: clerkUser.id, orgId: null },
    update: { role: "ADMIN", clerkId: clerkUser.id, orgId: null, active: true },
  });

  console.log(`Administrator ready: ${user.email} (id ${user.id})`);
  if (password) {
    console.log(`One-time password: ${password}`);
    console.log("Sign in and switch on two-step verification. Change this password afterwards.");
  } else {
    console.log("A Clerk account with this email already existed, so its password was not changed.");
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
