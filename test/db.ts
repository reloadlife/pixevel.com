import { getDb } from "@/lib/db";

// Integration tests run against the local dev Postgres (npm run db:up).
// Each test wraps work in a transaction that is always rolled back.
export function getTestDb() {
  return getDb();
}

export async function withRollback<T>(fn: (tx: any) => Promise<T>): Promise<T> {
  const db = getDb();
  let out: T;
  await db
    .transaction(async (tx) => {
      out = await fn(tx);
      throw new RollbackSignal();
    })
    .catch((e) => {
      if (!(e instanceof RollbackSignal)) throw e;
    });
  return out!;
}

class RollbackSignal extends Error {}
