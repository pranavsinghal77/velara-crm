import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { env } from './env';

/**
 * A single Prisma client for the process.
 *
 * `tsx watch` re-executes modules on every save; without this global cache
 * each reload opened a fresh connection pool and the database eventually
 * refused new connections.
 */
const globalForPrisma = globalThis as unknown as {
  prismaPool?: Pool;
  prisma?: PrismaClient;
};

const pool =
  globalForPrisma.prismaPool ??
  new Pool({
    connectionString: env.DATABASE_URL,
    // Bounded so a burst of requests cannot exhaust the database's own
    // connection limit (Supabase poolers are stingy).
    max: env.isProduction ? 10 : 5,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    // Without this the adapter qualifies every table as "public".<table>,
    // whatever the connection's search_path says.
    adapter: new PrismaPg(pool, { schema: env.DB_SCHEMA }),
    log: env.isProduction ? ['warn', 'error'] : ['warn', 'error'],
  });

if (!env.isProduction) {
  globalForPrisma.prismaPool = pool;
  globalForPrisma.prisma = prisma;
}
