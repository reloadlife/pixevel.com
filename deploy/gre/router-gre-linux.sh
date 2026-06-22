#!/usr/bin/env bash
# Run ON your router (195.24.237.242) IF it is Linux. Gives the Pixevel server
# (195.24.237.131, GRE inner 10.255.0.19) internet via NAT. Idempotent.
set -euo pipefail

PEER=195.24.237.131         # the no-internet server (GRE outer/remote)
LOCAL=195.24.237.242        # this router (GRE outer/local)
TUN_LOCAL=10.255.0.20       # router's GRE inner IP
TUN_PEER=10.255.0.19        # server's GRE inner IP
TUN_NET=10.255.0.16/30      # covers .19/.20
WAN="eth0"                  # <-- your router's internet-facing interface (CHANGE)

modprobe ip_gre
ip tunnel add gre1 mode gre remote "$PEER" local "$LOCAL" ttl 255 2>/dev/null || true
ip addr add "$TUN_LOCAL" peer "$TUN_PEER" dev gre1 2>/dev/null || true
ip link set gre1 mtu 1476 up

sysctl -w net.ipv4.ip_forward=1

iptables -t nat -C POSTROUTING -s "$TUN_NET" -o "$WAN" -j MASQUERADE 2>/dev/null || \
  iptables -t nat -A POSTROUTING -s "$TUN_NET" -o "$WAN" -j MASQUERADE
iptables -C FORWARD -i gre1 -o "$WAN" -j ACCEPT 2>/dev/null || \
  iptables -A FORWARD -i gre1 -o "$WAN" -j ACCEPT
iptables -C FORWARD -i "$WAN" -o gre1 -m state --state RELATED,ESTABLISHED -j ACCEPT 2>/dev/null || \
  iptables -A FORWARD -i "$WAN" -o gre1 -m state --state RELATED,ESTABLISHED -j ACCEPT
# Clamp MSS so large packets survive the 1476-MTU tunnel.
iptables -t mangle -C FORWARD -p tcp --tcp-flags SYN,RST SYN -j TCPMSS --clamp-mss-to-pmtu 2>/dev/null || \
  iptables -t mangle -A FORWARD -p tcp --tcp-flags SYN,RST SYN -j TCPMSS --clamp-mss-to-pmtu

echo "Router GRE up. Server 10.255.0.19 should now reach the internet."
echo "Test from the server:  ping -c2 10.255.0.20  &&  ping -c2 1.1.1.1"
