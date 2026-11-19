import { execSync } from "node:child_process";
import { PrismaPg } from "@prisma/adapter-pg";
import type { TestProject } from "vitest/node";
import { PrismaClient } from "@/app/generated/prisma/client";

export default async function setup(project: TestProject) {
  const url = project.config.env.DATABASE_URL;

  if (!url) {
    throw new Error("Set DATABASE_URL to run the database tests. They use a separate database ending in _test.");
  }

  execSync("npx prisma migrate deploy", { env: { ...process.env, DATABASE_URL: url }, stdio: "pipe" });

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;

  await prisma.$executeRawUnsafe(`TRUNCATE ${tables.map(({ tablename }) => `"${tablename}"`).join(", ")} CASCADE`);
  await prisma.$disconnect();
}
