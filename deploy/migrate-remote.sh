#!/usr/bin/env bash
# Sync the DB schema to the server's Postgres over an SSH port-forward.
#
# Uses `db:push` (NOT db:migrate): this repo's migration files are drifted —
# several tables were added via push and never captured as migrations, so
# migrate would build an incomplete schema. push reflects the full schema.ts.
# No GRE needed — inbound SSH only. Run from your machine.
#
#   PIXEVEL_DB_PASSWORD='<db pw>' ./deploy/migrate-remote.sh
#
# Flags (env):
#   RESET=1  Drop & recreate the public schema before pushing. Use this when the
#            schema change drops/renames columns — `db:push` prompts interactively
#            to disambiguate rename-vs-drop and HANGS without a TTY (e.g. in a
#            piped deploy). On an empty DB the push is purely additive, so no
#            prompts. DESTRUCTIVE: wipes all data. Intended for dev/staging.
#   SEED=1   Run `db:seed` against the remote after a successful push.
set -euo pipefail

HOST="${PIXEVEL_HOST:-195.24.237.131}"
SSH_USER="${PIXEVEL_SSH_USER:-root}"
SSH_KEY="${PIXEVEL_SSH_KEY:-$HOME/.ssh/pixevel_deploy}"
LOCAL_PORT="${PIXEVEL_LOCAL_PG_PORT:-6543}"
DB_PASSWORD="${PIXEVEL_DB_PASSWORD:?set PIXEVEL_DB_PASSWORD (matches DATABASE_URL)}"
RESET="${RESET:-0}"
SEED="${SEED:-0}"

cd "$(dirname "$0")/.."

# Open a background tunnel: localhost:LOCAL_PORT -> server 127.0.0.1:5432
ssh -i "$SSH_KEY" -NL "${LOCAL_PORT}:127.0.0.1:5432" "${SSH_USER}@${HOST}" &
SSH_PID=$!
trap 'kill "$SSH_PID" 2>/dev/null || true' EXIT
sleep 2

URL="postgres://pixevel:${DB_PASSWORD}@127.0.0.1:${LOCAL_PORT}/pixevel"

if [ "$RESET" = "1" ]; then
  echo "==> RESET: dropping & recreating public schema (DESTRUCTIVE)"
  psql "$URL" -v ON_ERROR_STOP=1 -c 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;'
fi

echo "==> Pushing schema (db:push)"
# `db:push` exits 0 even when its interactive prompt aborts under a non-TTY, so
# we verify a known post-migration table afterwards rather than trusting it.
DATABASE_URL="$URL" bun run db:push

SENTINEL=$(psql "$URL" -tA -c 'select to_regclass('"'"'public."ProductOption"'"'"') is not null;')
if [ "$SENTINEL" != "t" ]; then
  echo "ERROR: schema push did not apply (ProductOption table missing)."
  echo "       The new schema drops columns; db:push needs a TTY to confirm, or"
  echo "       re-run with RESET=1 to push onto a clean schema (dev/staging)."
  exit 1
fi
echo "==> Schema verified (ProductOption present)."

if [ "$SEED" = "1" ]; then
  echo "==> Seeding remote catalog (db:seed)"
  DATABASE_URL="$URL" bun run db:seed
  echo "==> Seed complete."
fi

echo "Schema pushed."
