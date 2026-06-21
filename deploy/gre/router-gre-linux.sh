#!/usr/bin/env bash
# Run ON your router (195.24.237.242) IF it is Linux. Provides internet to the
# GRE peer via NAT. Idempotent.
set -euo pipefail

PEER=195.24.237.131         # the no-internet server
LOCAL=195.24.237.242        # this router's IP
TUN_LOCAL=10.10.10.1
TUN_NET=10.10.10.0/30
WAN="eth0"                  # <-- your router's internet-facing interface (CHANGE)

modprobe ip_gre
ip tunnel add gre1 mode gre remote "$PEER" local "$LOCAL" ttl 255 2>/dev/null || true
ip addr add "$TUN_LOCAL/30" dev gre1 2>/dev/null || true
ip link set gre1 mtu 1476 up

sysctl -w net.ipv4.ip_forward=1

iptables -t nat -C POSTROUTING -s "$TUN_NET" -o "$WAN" -j MASQUERADE 2>/dev/null || \
  iptables -t nat -A POSTROUTING -s "$TUN_NET" -o "$WAN" -j MASQUERADE
iptables -C FORWARD -i gre1 -o "$WAN" -j ACCEPT 2>/dev/null || \
  iptables -A FORWARD -i gre1 -o "$WAN" -j ACCEPT
iptables -C FORWARD -i "$WAN" -o gre1 -m state --state RELATED,ESTABLISHED -j ACCEPT 2>/dev/null || \
  iptables -A FORWARD -i "$WAN" -o gre1 -m state --state RELATED,ESTABLISHED -j ACCEPT
# Clamp MSS so large packets don't black-hole over the 1476-MTU tunnel.
iptables -t mangle -C FORWARD -p tcp --tcp-flags SYN,RST SYN -j TCPMSS --clamp-mss-to-pmtu 2>/dev/null || \
  iptables -t mangle -A FORWARD -p tcp --tcp-flags SYN,RST SYN -j TCPMSS --clamp-mss-to-pmtu

echo "GRE up. Persist net.ipv4.ip_forward + iptables rules (iptables-persistent) if you want it across reboots."
