#!/usr/bin/env bash
# One-time prod backfill: relabel legacy free-text currency "IRR" -> the new
# currency_code enum value "IRT" on every money table, so the text->enum cast in
# `db:push` (migrate-remote.sh / `bun run deploy`) succeeds instead of erroring
# with: invalid input value for enum currency_code: "IRR".
#
# IMPORTANT: amounts are ALREADY in Toman (products author in IRT and checkout
# converts to Toman before persisting). The "IRR" was only a mislabel. So this
# ONLY relabels the currency column — it does NOT divide amounts by 10.
#
# Run from your machine BEFORE re-running the deploy:
#   PIXEVEL_DB_PASSWORD='<db pw>' ./deploy/prod-currency-backfill.sh
# then:
#   bun run deploy        # schema push now succeeds (no IRR rows left)
set -euo pipefail

HOST="${PIXEVEL_HOST:-195.24.237.131}"
SSH_USER="${PIXEVEL_SSH_USER:-root}"
SSH_KEY="${PIXEVEL_SSH_KEY:-$HOME/.ssh/id_ed25519}"
LOCAL_PORT="${PIXEVEL_LOCAL_PG_PORT:-6543}"
DB_PASSWORD="${PIXEVEL_DB_PASSWORD:?set PIXEVEL_DB_PASSWORD (matches DATABASE_URL)}"

ssh -i "$SSH_KEY" -NL "${LOCAL_PORT}:127.0.0.1:5432" "${SSH_USER}@${HOST}" &
SSH_PID=$!
trap 'kill "$SSH_PID" 2>/dev/null || true' EXIT
sleep 2

URL="postgres://pixevel:${DB_PASSWORD}@127.0.0.1:${LOCAL_PORT}/pixevel"

# These columns are still TEXT at this point (the enum cast hasn't applied yet),
# so a plain string UPDATE is valid. Idempotent: re-running is a no-op.
echo "==> Relabeling currency 'IRR' -> 'IRT' on prod money tables"
psql "$URL" -v ON_ERROR_STOP=1 <<'SQL'
UPDATE "Order"               SET currency = 'IRT' WHERE currency = 'IRR';
UPDATE "Payment"             SET currency = 'IRT' WHERE currency = 'IRR';
UPDATE "Cart"                SET currency = 'IRT' WHERE currency = 'IRR';
UPDATE "Wallet"              SET currency = 'IRT' WHERE currency = 'IRR';
UPDATE "GiftCard"            SET currency = 'IRT' WHERE currency = 'IRR';
UPDATE "Subscription"        SET currency = 'IRT' WHERE currency = 'IRR';
UPDATE "SubscriptionInvoice" SET currency = 'IRT' WHERE currency = 'IRR';
SQL

echo "==> Remaining IRR rows (must be 0 across all tables):"
psql "$URL" -tA <<'SQL'
SELECT 'Order', count(*) FROM "Order" WHERE currency='IRR'
UNION ALL SELECT 'Payment', count(*) FROM "Payment" WHERE currency='IRR'
UNION ALL SELECT 'Cart', count(*) FROM "Cart" WHERE currency='IRR'
UNION ALL SELECT 'Wallet', count(*) FROM "Wallet" WHERE currency='IRR'
UNION ALL SELECT 'GiftCard', count(*) FROM "GiftCard" WHERE currency='IRR'
UNION ALL SELECT 'Subscription', count(*) FROM "Subscription" WHERE currency='IRR'
UNION ALL SELECT 'SubscriptionInvoice', count(*) FROM "SubscriptionInvoice" WHERE currency='IRR';
SQL

echo "==> Backfill done. Now run: bun run deploy"
