# Server hardening plan — pixevel.com (195.24.237.131)

Audit from 2026-06-22. Items are prioritized; each has a ready-to-apply recipe.
Most fold into `deploy/deploy.py` so they stay reproducible (re-run `bun run deploy`).
**Deferred by request** — this is the plan; apply when scheduled.

## Current good state
postgres bound to 127.0.0.1 only · app runs as non-root `pixevel` · `.env.production` mode 600 ·
`unattended-upgrades` installed · NTP synced · ufw active (22/80/443) · disk 11% · 3.8 GB RAM.

---

## P0 — urgent (real exposure)

### 1. Lock down SSH (currently password + root login enabled; root pw compromised)
`/etc/ssh/sshd_config.d/50-cloud-init.conf` has `PasswordAuthentication yes`; root login `yes`.
The shared root password is burned. Key auth already works (`~/.ssh/id_ed25519`).
```bash
# on the server, AFTER confirming key login works:
sed -i 's/^PasswordAuthentication .*/PasswordAuthentication no/' /etc/ssh/sshd_config.d/*.conf
printf 'PermitRootLogin prohibit-password\nPasswordAuthentication no\n' > /etc/ssh/sshd_config.d/60-pixevel.conf
passwd -l root            # or set a new strong one + keep it offline
systemctl reload ssh
```
pyinfra: `files.line` on the sshd_config.d files + `server.shell` reload. (Verify a 2nd key
session stays open before locking.)

### 2. Daily Postgres backups (none today)
```bash
install -d -o postgres -g postgres /var/backups/pixevel
cat >/etc/cron.daily/pixevel-pgdump <<'SH'
#!/bin/sh
ts=$(date +%F)
sudo -u postgres pg_dump -Fc pixevel > /var/backups/pixevel/pixevel-$ts.dump 2>/dev/null
find /var/backups/pixevel -name 'pixevel-*.dump' -mtime +14 -delete
SH
chmod +x /etc/cron.daily/pixevel-pgdump
```
Offsite copy is better once there's a reliable outbound path; local-only is the floor.
pyinfra: `files.put` the script + `files.directory`.

---

## P1

### 3. fail2ban (SSH brute-force jail)
`apt install fail2ban`; default `sshd` jail is enough. pyinfra: add `fail2ban` to `apt.packages`,
drop `/etc/fail2ban/jail.d/sshd.local` (`enabled=true`, `bantime=1h`, `maxretry=5`).

### 4. Swapfile (3.8 GB RAM, 0 swap → OOM risk)
```bash
fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
grep -q /swapfile /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
sysctl -w vm.swappiness=10
```

### 5. nginx security headers + edge rate-limit on auth
Add to `deploy/files/nginx-locations.conf` (or a headers snippet, only on the `:443` blocks):
```nginx
add_header X-Content-Type-Options nosniff always;
add_header X-Frame-Options SAMEORIGIN always;
add_header Referrer-Policy strict-origin-when-cross-origin always;
# HSTS only once BOTH domains are reliably HTTPS (and Arvan edge SSL is on):
# add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
```
Edge rate-limit (defense-in-depth over the app's own limiter), in the site http context:
```nginx
limit_req_zone $binary_remote_addr zone=auth:10m rate=10r/m;
# then inside server{}: location /api/auth/ { limit_req zone=auth burst=5 nodelay; proxy_pass ...; }
```
Be careful behind Arvan — `$binary_remote_addr` must be the real client (the `real_ip`
config already handles that).

### 6. Cert auto-renew (currently manual — `.com` expires Sep 20)
The cert was issued by acme.sh manual DNS-01; certbot's cron won't renew it. Either:
- Give acme.sh a Cloudflare token and switch to `--dns dns_cf` → it auto-renews + reloads nginx; or
- Keep the manual flow (see `README.md` TLS section) and put a calendar reminder before Sep 20.

### 7. Cap journald (currently unbounded; worse with OTP logging)
```bash
mkdir -p /etc/systemd/journald.conf.d
printf '[Journal]\nSystemMaxUse=500M\nMaxRetentionSec=2week\n' > /etc/systemd/journald.conf.d/pixevel.conf
systemctl restart systemd-journald
```

### 8. Turn off `OTP_DEBUG_LOG`
Once Kavenegar SMS works, set `OTP_DEBUG_LOG=0` in `deploy/secrets.env` and `bun run deploy`.

---

## P2

### 9. GRE single-point-of-failure
`default dev gre1` — if the tunnel/router drops, ALL outbound dies (Kavenegar, payment
callbacks, registrar APIs). The site still serves locally. Options: a watchdog that pings
`10.255.0.20` and restarts `pixevel-gre.service` on failure; a 2nd GRE peer; or alerting.
At minimum, a healthcheck + alert on tunnel loss.

### 10. Monitoring / alerting (none)
Cert expiry, disk %, service-down, tunnel-down. A lightweight uptime check + a cron that
alerts (email/Telegram) on cert <14 days or disk >85%.

### 11. Verify unattended-upgrades is actually enabled
`cat /etc/apt/apt.conf.d/20auto-upgrades` → both `Update-Package-Lists` and
`Unattended-Upgrade` should be `"1"`.
