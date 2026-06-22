"""pyinfra deploy for Pixevel — full server configuration (artifact mode).

Single source of truth for the box at 195.24.237.131. Idempotent; re-run via
`bun run deploy` (which builds locally first, then invokes this).

Covers: GRE uplink persistence, apt (ArvanCloud mirror) + packages + ufw, Node
(shipped tarball), the standalone artifact (uploads preserved), Postgres role/db,
nginx with static-asset caching + conditional HTTPS, and the systemd service.

Schema is pushed separately (`migrate-remote.sh`) — drizzle-kit isn't in the bundle.
Requires env PIXEVEL_DB_PASSWORD (matching DATABASE_URL in deploy/secrets.env);
`bun run deploy` sets it for you.
"""

import os

from pyinfra.facts.files import File
from pyinfra import host
from pyinfra.operations import apt, files, server, systemd

HERE = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.abspath(os.path.join(HERE, ".."))

APP_USER = "pixevel"
APP_DIR = "/opt/pixevel"
NODE_VERSION = "22.12.0"
NODE_ARCH = "linux-x64"
NODE_DIR = "/opt/node"
NODE_BIN = f"{NODE_DIR}/bin/node"
ENV_FILE = f"{APP_DIR}/.env.production"
NODE_PORT = 3000

DB_NAME = "pixevel"
DB_USER = "pixevel"
DB_PASSWORD = os.environ.get("PIXEVEL_DB_PASSWORD", "")

USE_MIRROR = os.environ.get("PIXEVEL_APT_MIRROR", "1") == "1"
MANAGE_GRE = os.environ.get("PIXEVEL_MANAGE_GRE", "1") == "1"

STANDALONE = f"{REPO_ROOT}/.next/standalone"
LOCAL_NODE_TARBALL = f"{HERE}/node-{NODE_ARCH}.tar.xz"

# GRE uplink (server has no upstream internet of its own).
GRE = {
    "gre_if": "gre1",
    "gre_local": "195.24.237.131",
    "gre_router": "195.24.237.242",
    "gre_inner_local": "10.255.0.19",
    "gre_inner_peer": "10.255.0.20",
    "wan_gw": "195.24.237.1",
}

if not DB_PASSWORD:
    raise SystemExit("Set PIXEVEL_DB_PASSWORD (matches DATABASE_URL in deploy/secrets.env).")
if not os.path.isdir(STANDALONE):
    raise SystemExit("No build at .next/standalone — run `bun run build` first.")

# ─── GRE uplink persistence ─────────────────────────────────────────────────────

if MANAGE_GRE:
    files.template(
        name="GRE uplink script",
        src=f"{HERE}/files/pixevel-gre.sh",
        dest="/usr/local/sbin/pixevel-gre.sh",
        mode="755",
        **GRE,
    )
    files.put(
        name="GRE uplink unit",
        src=f"{HERE}/files/pixevel-gre.service",
        dest="/etc/systemd/system/pixevel-gre.service",
        mode="644",
    )
    systemd.service(
        name="Enable GRE uplink",
        service="pixevel-gre.service",
        running=True,
        enabled=True,
        daemon_reload=True,
    )

# ─── apt (domestic mirror) + packages + firewall ────────────────────────────────

if USE_MIRROR:
    files.put(
        name="apt-mirror setup",
        src=f"{HERE}/files/setup-apt-mirror.sh",
        dest="/tmp/setup-apt-mirror.sh",
        mode="755",
    )
    server.shell(name="Point apt at ArvanCloud mirror", commands=["/tmp/setup-apt-mirror.sh"])

apt.update(name="apt update", cache_time=3600)
apt.packages(
    name="Base packages",
    packages=[
        "ca-certificates", "curl", "xz-utils", "rsync",
        "nginx", "postgresql", "postgresql-contrib", "ufw",
    ],
)
server.shell(
    name="Firewall: 22/80/443",
    commands=[
        "ufw allow 22/tcp", "ufw allow 80/tcp", "ufw allow 443/tcp",
        "ufw --force enable", "ufw status",
    ],
)

# ─── App user + Node runtime ─────────────────────────────────────────────────────

server.user(name="App user", user=APP_USER, home=APP_DIR, shell="/bin/bash", create_home=True)
files.directory(name="App dir", path=APP_DIR, user=APP_USER, group=APP_USER, mode="755")

NODE_PKG = f"node-v{NODE_VERSION}-{NODE_ARCH}"
if os.path.exists(LOCAL_NODE_TARBALL):
    files.put(name="Node tarball", src=LOCAL_NODE_TARBALL, dest="/tmp/node.tar.xz", mode="644")
    server.shell(
        name="Install Node (shipped)",
        commands=[
            f"test -x {NODE_BIN} || (mkdir -p {NODE_DIR} && "
            f"tar -xJf /tmp/node.tar.xz -C {NODE_DIR} --strip-components=1)",
        ],
    )
else:
    server.shell(
        name="Install Node (download)",
        commands=[
            f"test -x {NODE_BIN} || (mkdir -p {NODE_DIR} && cd /tmp && "
            f"(curl -fsSLo node.tar.xz https://nodejs.org/dist/v{NODE_VERSION}/{NODE_PKG}.tar.xz || "
            f" curl -fsSLo node.tar.xz https://cdn.npmmirror.com/binaries/node/v{NODE_VERSION}/{NODE_PKG}.tar.xz) && "
            f"tar -xJf node.tar.xz -C {NODE_DIR} --strip-components=1 && rm node.tar.xz)",
        ],
    )

# ─── Ship the standalone artifact (NEVER touch statics/ — user uploads live there) ─

files.rsync(
    name="Sync standalone server",
    src=f"{STANDALONE}/",
    dest=f"{APP_DIR}/",
    flags=[
        "-a", "--delete",
        "--exclude=statics",   # user uploads — preserved across deploys
        "--exclude=.env*",
        "--exclude=public",
        "--exclude=.next/static",
        "--exclude=artifacts", "--exclude=test", "--exclude=docs",
    ],
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
files.put(name="Production env", src=f"{HERE}/secrets.env", dest=ENV_FILE, mode="600")
server.shell(
    name="Own app files (keep statics)",
    commands=[f"mkdir -p {APP_DIR}/statics && chown -R {APP_USER}:{APP_USER} {APP_DIR}"],
)

# ─── PostgreSQL role + database ──────────────────────────────────────────────────

server.shell(
    name="Create DB role + database",
    commands=[
        "sudo -u postgres psql -tAc \"SELECT 1 FROM pg_roles WHERE rolname='%s'\" | grep -q 1 || "
        "sudo -u postgres psql -qc \"CREATE ROLE %s LOGIN PASSWORD '%s'\""
        % (DB_USER, DB_USER, DB_PASSWORD),
        "sudo -u postgres psql -qc \"ALTER ROLE %s PASSWORD '%s'\"" % (DB_USER, DB_PASSWORD),
        "sudo -u postgres psql -tAc \"SELECT 1 FROM pg_database WHERE datname='%s'\" | grep -q 1 || "
        'sudo -u postgres psql -qc "CREATE DATABASE %s OWNER %s"' % (DB_NAME, DB_NAME, DB_USER),
    ],
)

# ─── systemd app service ─────────────────────────────────────────────────────────

files.template(
    name="systemd unit",
    src=f"{HERE}/files/pixevel.service",
    dest="/etc/systemd/system/pixevel.service",
    mode="644",
    app_user=APP_USER, app_dir=APP_DIR, env_file=ENV_FILE,
    node_bin=NODE_BIN, node_port=NODE_PORT,
)
systemd.service(
    name="Restart app",
    service="pixevel.service",
    running=True, enabled=True, restarted=True, daemon_reload=True,
)

# ─── nginx (static caching + conditional HTTPS) ──────────────────────────────────

files.template(
    name="nginx locations snippet",
    src=f"{HERE}/files/nginx-locations.conf",
    dest="/etc/nginx/snippets/pixevel-locations.conf",
    mode="644",
    app_dir=APP_DIR, node_port=NODE_PORT,
)
files.template(
    name="nginx site",
    src=f"{HERE}/files/nginx-pixevel.conf",
    dest="/etc/nginx/sites-available/pixevel.conf",
    mode="644",
    # only emit a :443 block when its cert is actually on the box
    has_com_cert=host.get_fact(File, "/etc/ssl/pixevel/com.crt") is not None,
    has_ir_cert=host.get_fact(File, "/etc/ssl/pixevel/ir.crt") is not None,
)
files.link(
    name="Enable nginx site",
    path="/etc/nginx/sites-enabled/pixevel.conf",
    target="/etc/nginx/sites-available/pixevel.conf",
)
files.file(name="Remove default site", path="/etc/nginx/sites-enabled/default", present=False)
server.shell(name="nginx config test", commands=["nginx -t"])
systemd.service(
    name="Reload nginx",
    service="nginx.service",
    running=True, enabled=True, reloaded=True,
)
