import "dotenv/config";

import { runBillingTick } from "@/lib/subscriptions/billing";

/**
 * Run one subscription-billing tick from the shell (cron / manual ops).
 *
 * Equivalent to hitting /api/cron/subscriptions but without the HTTP layer —
 * handy for local runs and as a fallback if the systemd timer is unavailable.
 *
 * Run: bun run cron:tick
 *
 * NOTE: pulls in app code marked `server-only`; the `cron:tick` script runs
 * tsx with `--conditions=react-server` so that marker resolves to its no-op.
 */

async function main() {
  const result = await runBillingTick(new Date());
  console.log("[cron:tick] billing tick complete:", JSON.stringify(result));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("[cron:tick] billing tick failed:", error);
    process.exit(1);
  });
