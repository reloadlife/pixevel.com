# Pixevel manual deploy (pyinfra) — Iran-hosted, no foreign internet

Deploys the Next.js app onto `195.24.237.131` (root) over SSH.

**Connectivity model:** the server is reachable for **inbound SSH** but has **no
outbound foreign internet**. Iranian mirrors (ArvanCloud) are reachable
domestically. So this deploy:

1. Builds the app **on your machine** (full internet — bundles the Vazirmatn font
   and all deps into `.next/standalone`).
2. Installs system packages on the server from the **ArvanCloud apt mirror**.
3. Ships the standalone artifact via **rsync over SSH** and runs it on **Node**.
4. Applies migrations over an **SSH port-forward**.

Result: **no GRE needed.** GitHub (Bun) and Google Fonts are only touched on your
machine at build time. GRE remains available as a fallback (`gre/`, see bottom).

> ⚠️ The root password was shared in plaintext — treat it as compromised. Switch to
> SSH keys (step 2) and **rotate it** immediately. `deploy/secrets.env` is gitignored.

---

## Live production deployment (as deployed — 2026-06-21)

The staging/beta server is **live and serving** at:
- **https://pixevel.ir** — primary, behind the ArvanCloud CDN (edge TLS).
- **http://pixevel.com** — direct (domestic-reachable).

### Server facts
- `195.24.237.131` — Ubuntu 24.04 (noble), x86_64, root via SSH key (`~/.ssh/id_ed25519`).
- **No internet of its own** — not even the domestic mirror was reachable until the
  GRE tunnel was up. (The "no GRE needed" path above assumes the domestic mirror is
  directly reachable; on THIS host it was not — GRE was required.)
- Reachable for inbound **only from domestic IPs** — the upstream filters `:80`/`:443`
  (and `:22`) by geography. Foreign IPs (incl. Let's Encrypt) are dropped.

### Internet path — GRE uplink via a MikroTik CHR
The server has no upstream internet, so it tunnels out through a MikroTik CHR.

```
server 195.24.237.131  ──GRE(proto47)──►  MikroTik CHR 195.24.237.242 ──NAT──► internet
   gre1 inner 10.255.0.19  ◄────────────►  gre-pixevel inner 10.255.0.20
```

- **Server side** (persistent via `pixevel-gre.service` → `/usr/local/sbin/pixevel-gre.sh`):
  `gre1` mode gre, remote `195.24.237.242` local `195.24.237.131`, MTU 1476,
  `ip addr add 10.255.0.19 peer 10.255.0.20`, pin `195.24.237.242/32 via 195.24.237.1`,
  then `default dev gre1`, resolv.conf → `8.8.8.8`.
- **MikroTik side** (`deploy/gre/router-gre-mikrotik.rsc`): GRE peer, NAT masquerade of
  `10.255.0.16/30` out the real WAN (`ether1` → `195.24.237.1`), forward accepts +
  a global `established,related` accept, MSS clamp.
- **Two gotchas that cost real debugging time:**
  1. **Route bug:** the CHR's `gre-pixevel` was `10.255.0.20/30`, which does **not**
     contain the server's `.19`, so return traffic was sent out ether1 instead of the
     tunnel. Fix on the CHR: `/ip route add dst-address=10.255.0.19/32 gateway=gre-pixevel`.
  2. **Firewall ordering:** internet replies were dropped by the default WAN-drop above
     our accept. Fix on the CHR: a `chain=forward connection-state=established,related
     action=accept` at the very top.
  3. Inner `ping 10.255.0.20` from the server stays timing out (input-chain on the
     router) — irrelevant; only the forward path matters.

### What actually runs on the box
| Unit | Role |
|---|---|
| `pixevel-gre.service` | brings up the GRE uplink at boot (oneshot) |
| `postgresql` | local DB `pixevel` (role `pixevel`), listens on localhost only |
| `pixevel.service` | `node /opt/pixevel/server.js` (standalone), `:3000`, env from `/opt/pixevel/.env.production` |
| `nginx` | reverse proxy `:80` → `:3000`, real-IP + forwarded-proto for the Arvan CDN |
| `ufw` | allows 22/80/443 |

Layout: app at `/opt/pixevel` (owner `pixevel`), Node at `/opt/node`, env file
`/opt/pixevel/.env.production` (mode 600). DB password lives only in that file +
`deploy/secrets.env` (gitignored).

### One-command deploy
The whole thing — build, server configuration, app ship, schema — is one command,
driven by **pyinfra** (`deploy/deploy.py` is the single source of truth):

```bash
bun run deploy        # build locally → pyinfra configure+ship → db:push
bun run deploy:dry    # preview pyinfra changes, no apply, no schema push
make deploy           # same as bun run deploy
```

`deploy/deploy.sh` orchestrates it: derives `PIXEVEL_DB_PASSWORD` from
`secrets.env`, runs `bun run build`, resolves a pyinfra runner
(`uvx --python 3.13 --from pyinfra pyinfra`, no global install needed — Python
3.13 because pyinfra's `gevent` has no wheel on uvx's default 3.10), applies
`deploy.py` with `-y`, then pushes the schema via the SSH tunnel.

**What `deploy.py` manages** (idempotent, re-runnable): the GRE uplink
(`pixevel-gre.{sh,service}`), apt (ArvanCloud mirror) + packages + `ufw`, Node
(shipped tarball), the standalone artifact, Postgres role/db, the systemd service,
and nginx. It does **not** manage the TLS certs (those are issued out-of-band, see
below) — it only emits the `:443` server blocks when the cert files already exist.

### nginx — static caching & asset serving (best practice for Next standalone)
`files/nginx-pixevel.conf` + `files/nginx-locations.conf` (a shared snippet):
- **`/_next/static/`** → served by nginx from `/opt/pixevel/.next/static` with
  `Cache-Control: public, max-age=31536000, immutable` (content-hashed → safe forever).
  Offloads Node entirely. *(No separate `next export` — these are normal build output.)*
- **`/statics/`** (user uploads) → served by nginx from `/opt/pixevel/statics`, 30-day cache.
- **`/_next/image`** + everything else → proxied to the Node server (it sets its own
  cache headers for HTML / RSC / ISR).
- gzip tuning, HTTP/2, real-IP through the Arvan CDN, conditional HTTPS blocks.

> **Uploads are preserved:** the artifact rsync uses `--exclude=statics`, so
> `/opt/pixevel/statics` (user uploads, served by the `/statics/[...path]` route) is
> never deleted by a deploy.

### Operations runbook
```bash
SSH="ssh -i ~/.ssh/id_ed25519 root@195.24.237.131"
bun run deploy                                   # update app + config + schema
$SSH 'systemctl status pixevel --no-pager; journalctl -u pixevel -n 50 --no-pager'
$SSH 'systemctl restart pixevel'                 # bounce the app
# env change (e.g. admin phones): edit deploy/secrets.env, then `bun run deploy`
```

### TLS / SSL (set up 2026-06-21)
- **pixevel.com → real Let's Encrypt cert** issued via **DNS-01** (the geo-block makes
  HTTP-01 impossible). Issued locally with `acme.sh` (manual DNS mode — one TXT in the
  Cloudflare zone), installed at `/etc/ssl/pixevel/com.{crt,key}`, served by the nginx
  `:443` block for `pixevel.com`. Trusted, valid ~90 days.
  - ⚠️ **Renewal is manual** (manual DNS-01 can't auto-renew): before expiry, re-run
    `~/.acme.sh/acme.sh --renew -d pixevel.com --dns --yes-I-know-dns-manual-mode-enough-go-ahead-please --server letsencrypt`,
    re-add the printed TXT, then scp `fullchain.cer`+`pixevel.com.key` over and
    `systemctl reload nginx`. For **auto-renewal**, switch to a Cloudflare API token
    (`acme.sh --dns dns_cf`) with Zone:DNS:Edit.
- **pixevel.ir → self-signed** on the origin (`/etc/ssl/pixevel/ir.{crt,key}`, nginx
  `:443` block). For public HTTPS, **enable SSL for the domain in the ArvanCloud panel**
  (edge cert) — that's the only remaining step and it's panel-side, not server-side.

### Open items
- **pixevel.ir public HTTPS** — toggle SSL on in the **ArvanCloud panel** (edge cert;
  origin can stay HTTP, or point Arvan origin-pull at the self-signed `:443` no-verify).
- **`APP_BASE_URL`** is `https://pixevel.com` — now backed by a real cert (domestic).
- Admin: `PIXEVEL_ADMIN_PHONES=09359310395` (set 2026-06-21).

---

## What the mirror does and doesn't cover

| Need | Source | Covered by domestic mirror? |
|---|---|---|
| apt: postgres, nginx, node deps | ArvanCloud `mirror.arvancloud.ir` | ✅ |
| Bun binary | GitHub | ❌ → avoided (build is local) |
| Next build / Vazirmatn font | Google Fonts | ❌ → avoided (build is local) |
| Node 22 runtime | nodejs.org / npmmirror, or shipped tarball | ⚠️ ship the tarball if blocked |

---

## Prerequisites (your machine)

```bash
pipx install pyinfra      # or: uv tool install pyinfra
# rsync + bun + ssh installed locally
```

## Step 0 — secrets

```bash
cd deploy
cp secrets.env.example secrets.env
openssl rand -hex 32      # SESSION_SECRET
openssl rand -hex 32      # DB password (also goes in DATABASE_URL)
$EDITOR secrets.env       # DATABASE_URL, SESSION_SECRET, PIXEVEL_ADMIN_PHONES, ...
```
The DB password lives in two places that must match: `DATABASE_URL` in
`secrets.env`, and `PIXEVEL_DB_PASSWORD` you export for pyinfra + migrations.

## Step 1 — SSH key

```bash
ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519 -N ''        # if needed
ssh-copy-id -i ~/.ssh/id_ed25519.pub root@195.24.237.131  # password ONCE
```
(Password rotation left to you — note it was shared in plaintext in chat.)

## Step 2 — (only if nodejs.org is blocked) ship Node offline

If the server can't reach nodejs.org/npmmirror, download the Linux build on your
machine and drop it in `deploy/` — `deploy.py` will upload it instead:
```bash
curl -fsSLo deploy/node-linux-x64.tar.xz \
  https://nodejs.org/dist/v22.12.0/node-v22.12.0-linux-x64.tar.xz
```
(Use `linux-arm64` if the server is ARM — also change `NODE_ARCH` in `deploy.py`.)

## Step 3 — build locally

```bash
./deploy/build-local.sh        # bun install + bun run build → .next/standalone
```

## Step 4 — deploy

```bash
cd deploy
PIXEVEL_DB_PASSWORD='<db pw>' pyinfra inventory.py deploy.py
```
Order: apt mirror → packages → app user → Node → rsync artifact → env → DB
role/db → systemd `pixevel` → nginx :80 → start. `--dry` previews; `-v` verbose.

## Step 5 — migrations

```bash
PIXEVEL_DB_PASSWORD='<db pw>' ./deploy/migrate-remote.sh   # via SSH tunnel
```

## Step 6 — verify

```bash
# Origin (bypasses CDN) — confirms the app serves:
curl -I -H 'Host: pixevel.com' http://195.24.237.131/
# Through the real domains:
curl -I https://pixevel.com/         # direct
curl -I https://pixevel.ir/          # via ArvanCloud edge
ssh root@195.24.237.131 'systemctl status pixevel --no-pager'
ssh root@195.24.237.131 'journalctl -u pixevel -n 50 --no-pager'
```

## Updates later

```bash
git pull
./deploy/build-local.sh
cd deploy && PIXEVEL_DB_PASSWORD='...' pyinfra inventory.py deploy.py
PIXEVEL_DB_PASSWORD='...' ./migrate-remote.sh   # only if schema changed
```

---

## Gotchas

- **Artifact layout:** `next start` is NOT used. We run `node server.js` from
  `.next/standalone`, with `.next/static` and `public/` rsync'd alongside — the
  deploy handles all three.
- **Node version:** engine requires >=22.12. apt won't have it; the deploy uses a
  tarball (downloaded or shipped). Don't rely on `apt install nodejs`.
- **Mirror reachability:** if `apt update` fails, the ArvanCloud mirror or your
  codename is off — check `gre/`'s fallback, or try another domestic mirror
  (e.g. `repo.iut.ac.ir`, `mirror.0-1.ir`) by editing `files/setup-apt-mirror.sh`.
## Domains & TLS

- **pixevel.com (direct):** needs its own cert. With outbound up (GRE) run on the server:
  ```bash
  apt install -y certbot python3-certbot-nginx
  certbot --nginx -d pixevel.com -d www.pixevel.com   # ACME needs outbound
  ```
- **pixevel.ir (ArvanCloud CDN):** Arvan terminates TLS at the edge — no origin
  cert required. Set Arvan's origin/pull protocol to HTTP (port 80) pointing at
  `195.24.237.131`. The nginx `map`/`real_ip` config already reads Arvan's
  `X-Forwarded-Proto` + real visitor IP.
- **Real-IP ranges:** the `set_real_ip_from` lines in `files/nginx-pixevel.conf`
  are a starting set — replace with Arvan's current official IP list, or `.ir`
  rate-limiting/analytics will attribute every visitor to the CDN edge.
- `APP_BASE_URL`/`NEXT_PUBLIC_SITE_URL` point at **https://pixevel.com** (direct)
  so payment callbacks aren't affected by CDN caching of POSTs.

---

## Fallback: GRE (only if you'd rather build ON the server)

If you prefer the server to install Bun + build itself, give it outbound via GRE
(`gre/server-gre.sh` + `gre/router-gre-linux.sh` or `gre/router-gre-mikrotik.rsc`),
then run with `PIXEVEL_APT_MIRROR=0` and switch back to a server-side build. The
mirror+local-build path above is recommended; GRE is the heavier alternative.
See the GRE scripts' inline comments (mind the lockout warning in `server-gre.sh`).
```
