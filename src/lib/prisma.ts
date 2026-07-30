import { PrismaPg } from "@prisma/adapter-pg";

// Prisma 7's `prisma-client` generator emits into `src/generated/prisma`
// (see prisma/schema.prisma). It is NOT importable from `@prisma/client`.
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set.");
  }

  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

// Reused across hot reloads in dev so Neon doesn't collect a new pool per edit.
export const db = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
