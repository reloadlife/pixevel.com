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
