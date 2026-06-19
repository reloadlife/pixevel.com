import { expect, test } from "vitest";
import { getDb } from "@/lib/db";

test("db reachable", async () => {
  const rows = await getDb().query.products.findMany({ limit: 1 });
  expect(Array.isArray(rows)).toBe(true);
});
