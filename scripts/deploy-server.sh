#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/root/pixevel}"
BRANCH="${BRANCH:-main}"
HOST_PORT="${HOST_PORT:-3050}"

install_docker_if_missing() {
  if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
    return
  fi

  if command -v apt-get >/dev/null 2>&1; then
    apt-get update
    apt-get install -y ca-certificates curl
  elif command -v dnf >/dev/null 2>&1; then
    dnf install -y ca-certificates curl
  elif command -v yum >/dev/null 2>&1; then
    yum install -y ca-certificates curl
  fi

  curl -fsSL https://get.docker.com | sh
  systemctl enable --now docker >/dev/null 2>&1 || service docker start
}

ensure_env_file() {
  touch .env

  if ! grep -q '^POSTGRES_DB=' .env; then
    printf '\nPOSTGRES_DB=pixevel\n' >> .env
  fi

  if ! grep -q '^POSTGRES_USER=' .env; then
    printf 'POSTGRES_USER=pixevel\n' >> .env
  fi

  if ! grep -q '^POSTGRES_PASSWORD=' .env; then
    password="$(openssl rand -hex 16)"
    printf 'POSTGRES_PASSWORD=%s\n' "$password" >> .env
  fi

  if ! grep -q '^HOST_PORT=' .env; then
    printf 'HOST_PORT=%s\n' "$HOST_PORT" >> .env
  fi

  if ! grep -q '^SESSION_SECRET=' .env; then
    printf 'SESSION_SECRET=%s\n' "$(openssl rand -hex 32)" >> .env
  fi

  if ! grep -q '^KAVENEGAR_OTP_TEMPLATE=' .env; then
    printf 'KAVENEGAR_OTP_TEMPLATE=cancelappointmentotp\n' >> .env
  fi

  if ! grep -q '^TELEGRAM_LOGIN_OTP_CHAT_ID=' .env; then
    printf 'TELEGRAM_LOGIN_OTP_CHAT_ID=-1003860300440\n' >> .env
  fi

  if ! grep -q '^TELEGRAM_LOGIN_OTP_BOT_TOKEN=' .env; then
    printf 'TELEGRAM_LOGIN_OTP_BOT_TOKEN=\n' >> .env
  fi

  mkdir -p statics
  chown -R 1001:1001 statics >/dev/null 2>&1 || true
}

update_checkout() {
  if [ "${SKIP_GIT_PULL:-0}" = "1" ]; then
    return
  fi

  if ! git diff --quiet || ! git diff --cached --quiet || [ -n "$(git ls-files --others --exclude-standard)" ]; then
    git stash push --include-untracked -m "pre-deploy-${BRANCH}-$(date -u +%Y%m%dT%H%M%SZ)"
  fi

  git fetch origin "$BRANCH"

  if [ "$(git branch --show-current)" != "$BRANCH" ]; then
    git checkout "$BRANCH"
  fi

  git pull --ff-only origin "$BRANCH"
}

wait_for_health() {
  for attempt in $(seq 1 30); do
    if curl -fsS "http://127.0.0.1:${HOST_PORT}/api/health" >/tmp/pixevel-health.json; then
      cat /tmp/pixevel-health.json
      printf '\n'
      return
    fi

    sleep 2
  done

  docker compose logs --tail=120 app
  return 1
}

cd "$APP_DIR"

git config --global --add safe.directory "$APP_DIR"

install_docker_if_missing
ensure_env_file
update_checkout

docker compose up -d postgres

# Build first so the previous app container keeps serving traffic during the slow path.
docker compose build app migrate
docker compose run --rm migrate

# Recreate only the web container after the new image and schema are ready.
docker compose up -d --no-deps app
wait_for_health

docker image prune -f --filter "until=168h" >/dev/null || true
