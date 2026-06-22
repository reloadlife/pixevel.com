#!/usr/bin/env bash
# Pixevel GRE uplink — the server has no upstream internet of its own, so it
# tunnels out through a MikroTik CHR. Rendered + installed by pyinfra; run at
# boot by pixevel-gre.service. Idempotent.
set +e
modprobe ip_gre
ip link del {{ gre_if }} 2>/dev/null
ip tunnel add {{ gre_if }} mode gre remote {{ gre_router }} local {{ gre_local }} ttl 255
ip addr add {{ gre_inner_local }} peer {{ gre_inner_peer }} dev {{ gre_if }}
ip link set {{ gre_if }} mtu 1476 up
# keep the GRE outer peer reachable directly, then send default through the tunnel
ip route replace {{ gre_router }}/32 via {{ wan_gw }}
ip route replace default dev {{ gre_if }}
printf 'nameserver 8.8.8.8\nnameserver 1.1.1.1\n' > /etc/resolv.conf
