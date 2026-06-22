# SIP trunk → support line (plan)

Goal: use your SIP trunk on the server for a **support phone line** (inbound calls
to agents, outbound click-to-call), and optionally voice as a backup OTP channel.
**OTP itself rides Kavenegar** (SMS + `type=call` voice) — see below — so this is
not on the OTP critical path.

> Nothing here is built yet. It needs your trunk credentials + a couple of decisions.

## What to install
- **Asterisk** (`apt install asterisk`) — lighter than FreeSWITCH, ubiquitous in IR VoIP.
  Use the **PJSIP** stack (`pjsip.conf`), not the legacy chan_sip.
- Register the trunk as a PJSIP **endpoint + auth + registration** (outbound registration
  means the provider pushes inbound calls down the registered connection — avoids opening
  inbound SIP/RTP through the geo-block).

`pjsip.conf` skeleton (fill from the provider):
```
[trunk-reg]
type=registration
outbound_auth=trunk-auth
server_uri=sip:<provider-host>
client_uri=sip:<username>@<provider-host>
retry_interval=60

[trunk-auth]
type=auth
auth_type=userpass
username=<username>
password=<password>

[trunk]
type=endpoint
context=from-trunk
disallow=all
allow=alaw            ; Iranian trunks: alaw/ulaw; add g729 if licensed
outbound_auth=trunk-auth
aors=trunk
from_user=<username>
[trunk-aor]
type=aor
contact=sip:<provider-host>
```

## Network — the important part
The server's `default` route is the **GRE tunnel** (1476 MTU). Running RTP (voice) over
GRE = jitter/choppy audio + NAT headaches.
- **Route the trunk's IP directly via eth0**, not the tunnel:
  ```bash
  ip route add <trunk_ip>/32 via 195.24.237.1
  ```
  (add it to `pixevel-gre.sh` so it survives reboots). Domestic trunk → also lower latency.
- ufw: allow `5060/udp` and the RTP range `10000-20000/udp` **scoped to the trunk IP**
  (`ufw allow from <trunk_ip> to any port 10000:20000 proto udp`).
- If the box is NAT'd from the trunk's view, set `external_media_address` /
  `external_signaling_address` in `pjsip.conf` transport.

## App integration (when wanted)
- **Inbound support**: `context=from-trunk` → dialplan rings agent endpoint(s) or a queue.
  Agents register softphones (Zoiper/Linphone) to Asterisk over the LAN/VPN.
- **Outbound click-to-call / voice OTP via the trunk**: enable **ARI** (`ari.conf`, bound to
  127.0.0.1), and have the Next app (or a tiny Node bridge) call ARI
  `POST /channels` to originate a call, then `play` the digits. This slots into the existing
  OTP delivery abstraction as a `sendAsteriskVoiceOtp` provider if you ever want trunk-based OTP.
- **Persian audio**: Asterisk `SayDigits` is English. For Persian OTP/IVR you need Persian
  sound files (`asterisk-sounds-fa` or pre-recorded 0–9) or a TTS engine.

## Decisions needed before building
1. Trunk provider + **SIP host / username / password** (and the trunk's IP, for routing).
2. Is the trunk **domestic** (route via eth0) or foreign (must traverse GRE)?
3. Agents: how do they answer — softphones registered to Asterisk, or forward to a mobile?
4. Codecs the provider supports (alaw/ulaw/g729).

## Recommendation
Ship OTP on **Kavenegar** first (done in code — just needs the token). Stand up Asterisk for
the **support line** as a separate, self-contained workstream once you have the trunk creds;
keep it off the OTP path so a telephony issue never blocks logins.
