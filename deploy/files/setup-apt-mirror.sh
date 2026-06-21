#!/usr/bin/env bash
# Point apt at the ArvanCloud domestic mirror (reachable in Iran without foreign
# internet). Detects Ubuntu vs Debian. Backs up the existing sources once.
set -euo pipefail

. /etc/os-release
CN="${VERSION_CODENAME:-}"
M="http://mirror.arvancloud.ir"

[ -z "$CN" ] && { echo "Cannot detect VERSION_CODENAME from /etc/os-release"; exit 1; }
cp -n /etc/apt/sources.list /etc/apt/sources.list.bak 2>/dev/null || true

if [ "${ID:-}" = "ubuntu" ]; then
  # Ubuntu 24.04+ ships deb822 in ubuntu.sources — disable it to avoid duplicates.
  [ -f /etc/apt/sources.list.d/ubuntu.sources ] && \
    mv /etc/apt/sources.list.d/ubuntu.sources /etc/apt/sources.list.d/ubuntu.sources.disabled || true
  cat > /etc/apt/sources.list <<EOF
deb $M/ubuntu $CN main restricted universe multiverse
deb $M/ubuntu $CN-updates main restricted universe multiverse
deb $M/ubuntu $CN-security main restricted universe multiverse
EOF
elif [ "${ID:-}" = "debian" ]; then
  cat > /etc/apt/sources.list <<EOF
deb $M/debian $CN main contrib non-free non-free-firmware
deb $M/debian $CN-updates main contrib non-free non-free-firmware
deb $M/debian-security $CN-security main contrib non-free non-free-firmware
EOF
else
  echo "Unsupported distro: ${ID:-unknown}"; exit 1
fi

echo "apt now points at $M for $ID $CN"
