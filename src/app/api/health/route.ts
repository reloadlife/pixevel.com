import { sql } from "drizzle-orm";

import { getDb } from "@/lib/db";

export async function GET() {
  try {
    await getDb().execute(sql`SELECT 1`);

    return Response.json({
      ok: true,
      service: "pixevel",
      database: "connected",
    });
  } catch (error) {
    // Log details server-side; never leak DB/connection internals to callers.
    console.error("[health] database check failed:", error);
    return Response.json(
      {
        ok: false,
        service: "pixevel",
        database: "unavailable",
      },
      { status: 503 },
    );
  }
}
