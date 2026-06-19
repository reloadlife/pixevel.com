import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "@/db/schema";

type Db = NodePgDatabase<typeof schema>;

const globalForDb = globalThis as unknown as {
  db?: Db;
  pool?: Pool;
  databaseUrl?: string;
};

/**
 * Returns a singleton Drizzle client bound to the schema (so the relational
 * query API — `db.query.*` — is available). Re-created only when DATABASE_URL
 * changes, mirroring the previous Prisma helper.
 */
export function getDb(): Db {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required.");
  }

  if (!globalForDb.db || globalForDb.databaseUrl !== databaseUrl) {
    globalForDb.pool?.end().catch(() => {});

    const pool = new Pool({ connectionString: databaseUrl });

    globalForDb.pool = pool;
    globalForDb.db = drizzle({
      client: pool,
      schema,
      logger: process.env.NODE_ENV === "development",
    });
    globalForDb.databaseUrl = databaseUrl;
  }

  return globalForDb.db;
}
