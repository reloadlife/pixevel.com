#!/usr/bin/env bash
# Run ON the no-internet server (195.24.237.131) as root.
# Brings up a GRE tunnel to your router and sends outbound traffic through it.
#
# !! LOCKOUT WARNING !!
# This rewrites the default route. If you skip ADMIN_IP, your SSH session can
# freeze the moment the default route flips. Set ADMIN_IP to the PUBLIC IP of
# the machine you are SSH-ing FROM. Keep a console/IPMI handy just in case.
set -euo pipefail

LOCAL=195.24.237.131        # this server's WAN IP (GRE outer/local)
ROUTER=195.24.237.242       # router's WAN IP   (GRE outer/remote)
# Inner tunnel IPs. We use PEER-style addressing (host peer host), so .19 and .20
# need NOT share a subnet — this honors the router expecting the server at .19.
TUN_LOCAL=10.255.0.19       # tunnel IP on THIS server (what the router expects)
TUN_PEER=10.255.0.20        # router's GRE endpoint
ADMIN_IP="CHANGE_ME"        # <-- public IP you SSH from (prevents lockout)
WAN_GW="195.24.237.242"     # current default gateway. Confirm with: ip route | grep default
DNS="1.1.1.1"

[ "$ADMIN_IP" = "CHANGE_ME" ] && { echo "Set ADMIN_IP first (your SSH source IP)."; exit 1; }

modprobe ip_gre
ip tunnel add gre1 mode gre remote "$ROUTER" local "$LOCAL" ttl 255 2>/dev/null || true
# peer-style addressing makes the link point-to-point so we can route by device
# (avoids "invalid gateway" when the peer is a /30 network address like .20).
ip addr add "$TUN_LOCAL" peer "$TUN_PEER" dev gre1 2>/dev/null || true
ip link set gre1 mtu 1476 up

# Keep management traffic OFF the tunnel so SSH survives the default-route flip.
ip route replace "$ADMIN_IP/32" via "$WAN_GW"
ip route replace "$ROUTER/32"   via "$WAN_GW"

# Everything else goes through the tunnel (route by device — PtP, no via needed).
ip route replace default dev gre1

echo "nameserver $DNS" > /etc/resolv.conf

echo "--- testing outbound via tunnel ---"
ping -c2 -W2 1.1.1.1 || echo "NO ICMP yet — check the router side / firewall."
getent hosts bun.sh   || echo "DNS not resolving — check /etc/resolv.conf + router NAT."

# To REVERT:  ip route replace default via $WAN_GW ; ip link del gre1
