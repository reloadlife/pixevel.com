# Run on your router (195.24.237.242) IF it is MikroTik / RouterOS.
# Paste into a terminal or import as a script. Set $wan to your internet iface.
:local wan "ether1"

/interface gre add name=gre-pixevel local-address=195.24.237.242 remote-address=195.24.237.131 mtu=1476
/ip address add address=10.10.10.1/30 interface=gre-pixevel

# NAT the tunnel subnet out to the internet.
/ip firewall nat add chain=srcnat src-address=10.10.10.0/30 out-interface=$wan action=masquerade comment="pixevel GRE"

# Allow forwarding for the tunnel.
/ip firewall filter add chain=forward in-interface=gre-pixevel action=accept comment="pixevel GRE in"
/ip firewall filter add chain=forward out-interface=gre-pixevel connection-state=established,related action=accept comment="pixevel GRE out"

# Clamp MSS so large packets survive the 1476-MTU tunnel.
/ip firewall mangle add chain=forward protocol=tcp tcp-flags=syn action=change-mss new-mss=clamp-to-pmtu comment="pixevel MSS clamp"

# Make sure the GRE accept/clamp rules sit ABOVE any drop rule in your chains.
# Inspect order with:  /ip firewall filter print
