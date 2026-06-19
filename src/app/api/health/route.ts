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
    return Response.json(
      {
        ok: false,
        service: "pixevel",
        database: "unavailable",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 503 }
    );
  }
}
