import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

// The only built-in account. Everyone else is created from the Users page:
// Super Admin creates Admins, and Admins create MedTechs.
const SUPER_ADMIN = {
  id: "USR-001",
  name: "Super Administrator",
  username: "superadmin",
  email: "superadmin@cvrbc.doh.gov.ph",
  password: "admin123",
} as const;

async function main() {
  const passwordHash = await bcrypt.hash(SUPER_ADMIN.password, 10);

  // upsert = safe to run the seed more than once. Re-running will NOT reset
  // the password of an account that already exists.
  await prisma.user.upsert({
    where: { username: SUPER_ADMIN.username },
    update: {},
    create: {
      id: SUPER_ADMIN.id,
      name: SUPER_ADMIN.name,
      username: SUPER_ADMIN.username,
      email: SUPER_ADMIN.email,
      passwordHash,
      role: "SUPER_ADMIN",
      status: "ACTIVE",
    },
  });

  // The user counter must start at 1 so the next account becomes USR-002.
  await prisma.counter.upsert({
    where: { name: "user" },
    update: {},
    create: { name: "user", value: 1 },
  });

  console.log("Seed complete.");
  console.log(`  Super Admin -> username: ${SUPER_ADMIN.username}  password: ${SUPER_ADMIN.password}`);
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
