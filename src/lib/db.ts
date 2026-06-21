import "server-only";

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
 *
 * The `server-only` import marks this module as server-exclusive: `pg` is a
 * Node-only package, so if a Client Component ever pulls this module into the
 * browser bundle the build fails fast with a clear error here instead of an
 * opaque "Can't resolve dns/net/tls" from deep inside `pg`.
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
