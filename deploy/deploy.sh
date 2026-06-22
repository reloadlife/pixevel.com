#!/usr/bin/env bash
# One-command deploy: build locally → configure + ship via pyinfra → push schema.
# Invoked by `bun run deploy` / `make deploy`. Flags are passed through to pyinfra
# (e.g. --dry to preview, -v for verbose).
set -euo pipefail
cd "$(dirname "$0")/.."

SECRETS=deploy/secrets.env
[ -f "$SECRETS" ] || { echo "ERROR: $SECRETS missing (cp deploy/secrets.env.example …)"; exit 1; }

# DB password is derived from DATABASE_URL so there's a single source of truth.
DBURL=$(grep -E '^DATABASE_URL=' "$SECRETS" | head -1 | cut -d= -f2-)
PIXEVEL_DB_PASSWORD=$(printf '%s' "$DBURL" | sed -E 's#.*://[^:]+:([^@]+)@.*#\1#')
export PIXEVEL_DB_PASSWORD
[ -n "$PIXEVEL_DB_PASSWORD" ] || { echo "ERROR: couldn't parse DB password from DATABASE_URL"; exit 1; }

echo "==> [1/4] Build (standalone artifact)"
bun install --frozen-lockfile
bun run build
[ -d .next/standalone ] || { echo "ERROR: .next/standalone missing"; exit 1; }

# Resolve a pyinfra runner without requiring a global install.
echo "==> [2/4] Resolve pyinfra"
if command -v pyinfra >/dev/null 2>&1; then
  PYINFRA=(pyinfra)
elif command -v uvx >/dev/null 2>&1; then
  # pin 3.13 — pyinfra's gevent dep has no wheel on the uvx-default 3.10 (builds from source)
  PYINFRA=(uvx --python 3.13 --from pyinfra pyinfra)
elif command -v pipx >/dev/null 2>&1; then
  PYINFRA=(pipx run pyinfra)
else
  echo "    installing pyinfra (pip --user)…"
  python3 -m pip install --user --quiet --upgrade pyinfra
  PYINFRA=("$(python3 -c 'import sysconfig,os;print(os.path.join(sysconfig.get_path("scripts",f"{os.name}_user"),"pyinfra"))')")
fi
echo "    using: ${PYINFRA[*]}"

echo "==> [3/4] Configure + ship (pyinfra)"
( cd deploy && "${PYINFRA[@]}" inventory.py deploy.py -y "$@" )

# Skip schema push on a dry run.
case " $* " in *" --dry "*) echo "==> [4/4] (dry run) skipping schema push"; exit 0;; esac

echo "==> [4/4] Push DB schema"
PIXEVEL_SSH_KEY="${PIXEVEL_SSH_KEY:-$HOME/.ssh/id_ed25519}" \
  PIXEVEL_DB_PASSWORD="$PIXEVEL_DB_PASSWORD" \
  ./deploy/migrate-remote.sh

echo "==> Deploy complete."
