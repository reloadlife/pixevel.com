import { getSetting } from "@/lib/settings";
import { runBillingTick } from "@/lib/subscriptions/billing";

/**
 * Subscription renewal cron endpoint.
 *
 * Drives the recurring-billing engine: creates upcoming invoices, sends
 * renewal reminders, auto-renews from wallet, and marks past-due / expired
 * subscriptions. Invoked daily by the systemd timer (`pixevel-cron.timer`)
 * which curls this URL with the shared secret.
 *
 * Auth: the caller must send `x-cron-secret` matching the `CRON_SECRET`
 * setting. An unset/empty secret rejects ALL callers (fail closed) so the
 * endpoint can never run unauthenticated.
 */

export const dynamic = "force-dynamic";

async function handle(request: Request): Promise<Response> {
  const expected = await getSetting("CRON_SECRET");
  const provided = request.headers.get("x-cron-secret");

  // Fail closed: no configured secret → reject everyone.
  if (!expected || !provided || provided !== expected) {
    return Response.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  try {
    const result = await runBillingTick(new Date());
    return Response.json({ ok: true, result });
  } catch (error) {
    // Log server-side; never leak internals (DB errors / stack traces) to callers.
    console.error("[cron/subscriptions] billing tick failed:", error);
    return Response.json({ ok: false, error: "INTERNAL" }, { status: 500 });
  }
}

export function POST(request: Request) {
  return handle(request);
}

export function GET(request: Request) {
  return handle(request);
}
