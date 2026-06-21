#!/usr/bin/env bash
# Build the app ON YOUR machine (full internet — bundles the Vazirmatn font and
# all deps). Produces .next/standalone, which deploy.py ships to the server.
set -euo pipefail
cd "$(dirname "$0")/.."

bun install --frozen-lockfile
bun run build

[ -d .next/standalone ] || { echo "ERROR: .next/standalone missing (need output:'standalone')"; exit 1; }
echo
echo "Build OK. Next:"
echo "  cd deploy && PIXEVEL_DB_PASSWORD='<db pw>' pyinfra inventory.py deploy.py"
echo "  ./deploy/migrate-remote.sh   # apply migrations over SSH"
