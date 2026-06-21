import type { z } from "zod";

import { apiError } from "@/lib/api";

/**
 * Validate a request JSON body against a Zod schema at the API boundary.
 *
 * On success returns the typed, parsed data. On a malformed body or schema
 * mismatch returns a ready-to-send `apiError` Response (the caller just returns
 * it) — so handlers never operate on unchecked `as`-cast input.
 *
 * Usage:
 *   const parsed = await parseBody(request, Schema);
 *   if (!parsed.ok) return parsed.response;
 *   const { ... } = parsed.data;
 */
export async function parseBody<T extends z.ZodType>(
  request: Request,
  schema: T,
): Promise<{ ok: true; data: z.infer<T> } | { ok: false; response: Response }> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return { ok: false, response: apiError("INVALID_BODY", "بدنه درخواست نامعتبر است.") };
  }

  const result = schema.safeParse(raw);
  if (!result.success) {
    return { ok: false, response: apiError("INVALID_BODY", "ورودی نامعتبر است.") };
  }

  return { ok: true, data: result.data };
}
