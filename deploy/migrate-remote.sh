#!/usr/bin/env bash
# Sync the DB schema to the server's Postgres over an SSH port-forward.
# Uses `db:push` (NOT db:migrate): this repo's migration files are drifted —
# several tables were added via push and never captured as migrations, so
# migrate would build an incomplete schema. push reflects the full schema.ts.
# No GRE needed — inbound SSH only. Run from your machine.
#
#   PIXEVEL_DB_PASSWORD='<db pw>' ./deploy/migrate-remote.sh
set -euo pipefail

HOST="${PIXEVEL_HOST:-195.24.237.131}"
SSH_USER="${PIXEVEL_SSH_USER:-root}"
SSH_KEY="${PIXEVEL_SSH_KEY:-$HOME/.ssh/pixevel_deploy}"
LOCAL_PORT="${PIXEVEL_LOCAL_PG_PORT:-6543}"
DB_PASSWORD="${PIXEVEL_DB_PASSWORD:?set PIXEVEL_DB_PASSWORD (matches DATABASE_URL)}"

cd "$(dirname "$0")/.."

# Open a background tunnel: localhost:LOCAL_PORT -> server 127.0.0.1:5432
ssh -i "$SSH_KEY" -NL "${LOCAL_PORT}:127.0.0.1:5432" "${SSH_USER}@${HOST}" &
SSH_PID=$!
trap 'kill "$SSH_PID" 2>/dev/null || true' EXIT
sleep 2

DATABASE_URL="postgres://pixevel:${DB_PASSWORD}@127.0.0.1:${LOCAL_PORT}/pixevel" bun run db:push
echo "Schema pushed."
