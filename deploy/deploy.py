"""pyinfra deploy for Pixevel — artifact mode (no outbound foreign internet).

Designed for an Iran-hosted server reachable only via domestic network:
- System packages come from the ArvanCloud apt mirror (domestic).
- The app is BUILT LOCALLY (see build-local.sh) and the standalone artifact is
  rsync'd over SSH — so GitHub (Bun) and Google Fonts are never touched here.
- Node is installed from a tarball: a local copy if you drop one in deploy/,
  else downloaded on the server (only works if nodejs.org/npmmirror is reachable).
- Migrations run separately over an SSH port-forward (migrate-remote.sh).

Run from deploy/ AFTER building locally:
    ./build-local.sh
    PIXEVEL_DB_PASSWORD=... pyinfra inventory.py deploy.py

Disable the apt mirror rewrite with PIXEVEL_APT_MIRROR=0 (e.g. if GRE is up).
"""

import os

from pyinfra.operations import apt, files, server, systemd

# ─── Config ───────────────────────────────────────────────────────────────────

HERE = os.path.dirname(__file__)
REPO_ROOT = os.path.abspath(os.path.join(HERE, ".."))

APP_USER = "pixevel"
APP_DIR = "/opt/pixevel"
NODE_VERSION = "22.12.0"
NODE_ARCH = "linux-x64"  # change to linux-arm64 if the server is ARM
NODE_DIR = "/opt/node"
NODE_BIN = f"{NODE_DIR}/bin/node"
ENV_FILE = f"{APP_DIR}/.env.production"
NODE_PORT = 3000

DB_NAME = "pixevel"
DB_USER = "pixevel"
DB_PASSWORD = os.environ.get("PIXEVEL_DB_PASSWORD", "")

USE_MIRROR = os.environ.get("PIXEVEL_APT_MIRROR", "1") == "1"

STANDALONE = f"{REPO_ROOT}/.next/standalone"
LOCAL_NODE_TARBALL = f"{HERE}/node-{NODE_ARCH}.tar.xz"

if not DB_PASSWORD:
    raise SystemExit("Set PIXEVEL_DB_PASSWORD (must match DATABASE_URL in deploy/secrets.env).")
if not os.path.isdir(STANDALONE):
    raise SystemExit("No build found at .next/standalone — run deploy/build-local.sh first.")

# ─── apt mirror (domestic) ──────────────────────────────────────────────────────

if USE_MIRROR:
    files.put(
        name="Upload apt-mirror setup",
        src=f"{HERE}/files/setup-apt-mirror.sh",
        dest="/tmp/setup-apt-mirror.sh",
        mode="755",
    )
    server.shell(name="Point apt at ArvanCloud mirror", commands=["/tmp/setup-apt-mirror.sh"])

apt.update(name="apt update", cache_time=3600)
apt.packages(
    name="Base packages (from mirror)",
    packages=[
        "ca-certificates",
        "curl",
        "xz-utils",
        "rsync",
        "nginx",
        "postgresql",
        "postgresql-contrib",
        "ufw",
    ],
)

# Open inbound web ports. Allow SSH FIRST so enabling ufw can't lock us out.
# (If 80/443 stay unreachable after this, an upstream/datacenter firewall is
# dropping them — that's outside the box and must be opened in the provider panel.)
server.shell(
    name="Firewall: allow 22/80/443",
    commands=[
        "ufw allow 22/tcp",
        "ufw allow 80/tcp",
        "ufw allow 443/tcp",
        "ufw --force enable",
        "ufw status verbose",
    ],
)

# ─── App user + dir ─────────────────────────────────────────────────────────────

server.user(name="App user", user=APP_USER, home=APP_DIR, shell="/bin/bash", create_home=True)
files.directory(name="App dir", path=APP_DIR, user=APP_USER, group=APP_USER, mode="755")

# ─── Node runtime (local tarball preferred; else download) ───────────────────────

NODE_PKG = f"node-v{NODE_VERSION}-{NODE_ARCH}"
if os.path.exists(LOCAL_NODE_TARBALL):
    files.put(
        name="Upload Node tarball (offline)",
        src=LOCAL_NODE_TARBALL,
        dest="/tmp/node.tar.xz",
        mode="644",
    )
    server.shell(
        name="Install Node from uploaded tarball",
        commands=[
            f"test -x {NODE_BIN} || (mkdir -p {NODE_DIR} && "
            f"tar -xJf /tmp/node.tar.xz -C {NODE_DIR} --strip-components=1)",
        ],
    )
else:
    server.shell(
        name="Install Node (download — needs nodejs.org/npmmirror reachable)",
        commands=[
            f"test -x {NODE_BIN} || (mkdir -p {NODE_DIR} && cd /tmp && "
            f"(curl -fsSLo node.tar.xz https://nodejs.org/dist/v{NODE_VERSION}/{NODE_PKG}.tar.xz || "
            f" curl -fsSLo node.tar.xz https://cdn.npmmirror.com/binaries/node/v{NODE_VERSION}/{NODE_PKG}.tar.xz) && "
            f"tar -xJf node.tar.xz -C {NODE_DIR} --strip-components=1 && rm node.tar.xz)",
        ],
    )

# ─── Ship the standalone artifact (no outbound) ─────────────────────────────────

files.rsync(
    name="Sync standalone server",
    src=f"{STANDALONE}/",
    dest=f"{APP_DIR}/",
    flags=["-a", "--delete", "--exclude=.env*", "--exclude=public", "--exclude=.next/static"],
)
files.rsync(
    name="Sync static assets",
    src=f"{REPO_ROOT}/.next/static/",
    dest=f"{APP_DIR}/.next/static/",
    flags=["-a", "--delete"],
)
files.rsync(
    name="Sync public/",
    src=f"{REPO_ROOT}/public/",
    dest=f"{APP_DIR}/public/",
    flags=["-a", "--delete"],
)
files.put(
    name="Upload production env",
    src=f"{HERE}/secrets.env",
    dest=ENV_FILE,
    mode="600",
)
server.shell(name="Own app files", commands=[f"chown -R {APP_USER}:{APP_USER} {APP_DIR}"])

# ─── PostgreSQL role + database (local, no outbound) ─────────────────────────────

server.shell(
    name="Create DB role + database (idempotent)",
    commands=[
        "sudo -u postgres psql -tAc \"SELECT 1 FROM pg_roles WHERE rolname='%s'\" | grep -q 1 || "
        "sudo -u postgres psql -c \"CREATE ROLE %s LOGIN PASSWORD '%s'\""
        % (DB_USER, DB_USER, DB_PASSWORD),
        "sudo -u postgres psql -c \"ALTER ROLE %s PASSWORD '%s'\"" % (DB_USER, DB_PASSWORD),
        "sudo -u postgres psql -tAc \"SELECT 1 FROM pg_database WHERE datname='%s'\" | grep -q 1 || "
        'sudo -u postgres psql -c "CREATE DATABASE %s OWNER %s"' % (DB_NAME, DB_NAME, DB_USER),
    ],
)

# NOTE: migrations are applied separately via ./migrate-remote.sh (drizzle-kit is
# a dev dependency not present in the standalone bundle).

# ─── systemd service ────────────────────────────────────────────────────────────

files.template(
    name="systemd unit",
    src=f"{HERE}/files/pixevel.service",
    dest="/etc/systemd/system/pixevel.service",
    mode="644",
    app_user=APP_USER,
    app_dir=APP_DIR,
    env_file=ENV_FILE,
    node_bin=NODE_BIN,
    node_port=NODE_PORT,
)
systemd.service(
    name="Enable + (re)start app",
    service="pixevel.service",
    running=True,
    enabled=True,
    restarted=True,
    daemon_reload=True,
)

# ─── nginx reverse proxy ────────────────────────────────────────────────────────

files.template(
    name="nginx site",
    src=f"{HERE}/files/nginx-pixevel.conf",
    dest="/etc/nginx/sites-available/pixevel.conf",
    mode="644",
    node_port=NODE_PORT,
)
files.link(
    name="Enable nginx site",
    path="/etc/nginx/sites-enabled/pixevel.conf",
    target="/etc/nginx/sites-available/pixevel.conf",
)
files.file(name="Remove default nginx site", path="/etc/nginx/sites-enabled/default", present=False)
server.shell(name="nginx config test", commands=["nginx -t"])
systemd.service(name="Reload nginx", service="nginx.service", running=True, enabled=True, reloaded=True)
