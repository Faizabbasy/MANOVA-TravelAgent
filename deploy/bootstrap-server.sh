#!/usr/bin/env bash
# One-time server preparation for MANOVA on the shared server. Safe to re-run.
# Run by the operator's setup script with ci-entry.sh, nginx-manova.conf and (optionally) ci-key.pub next to it.
#
# Creates ONLY MANOVA's own things and refuses to continue if a port or path is already used by something else:
#   ~/project/manova                         git checkout
#   ~/project/manova-ci-entry.sh             deploy entry point (forced command of the CI key)
#   PostgreSQL database `manova` + role `manova_user`   (password generated here, stored in backend/.env only)
#   /etc/nginx/sites-available/manova        public entry on :8092
#   one line in ~/.ssh/authorized_keys       CI key, locked to the deploy entry point
set -Eeuo pipefail
export LC_ALL=C.UTF-8

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_URL="${MANOVA_REPO_URL:-https://github.com/Faizabbasy/MANOVA-TravelAgent.git}"
REPO="$HOME/project/manova"
ENTRY="$HOME/project/manova-ci-entry.sh"
PG_PORT="${MANOVA_PG_PORT:-7700}"
DB=manova
DB_USER=manova_user
API_PORT=4110
WEB_PORT=4111
PUBLIC_PORT=8092
PUBLIC_ORIGIN="${MANOVA_PUBLIC_ORIGIN:-http://103.87.67.210:$PUBLIC_PORT}"
KEY_COMMENT=manova-github-actions

step() { echo; echo "--> $*"; }
die() { echo "BOOTSTRAP STOPPED: $*" >&2; exit 1; }
psql_admin() { (cd /tmp && sudo -n -u postgres psql -p "$PG_PORT" -X -q -v ON_ERROR_STOP=1 "$@"); }
listening() { ss -Htln "sport = :$1" | grep -q .; }

# ---- preflight: nothing below may collide with another project -------------------------------------------
step "preflight"
sudo -n true || die "passwordless sudo is required"
[ -f "$HERE/ci-entry.sh" ] && [ -f "$HERE/nginx-manova.conf" ] || die "ci-entry.sh / nginx-manova.conf missing next to this script"
for p in "$API_PORT" "$WEB_PORT"; do
  if listening "$p" && ! pm2 describe manova-api >/dev/null 2>&1; then die "port $p is already in use by something else"; fi
done
if listening "$PUBLIC_PORT" && [ ! -e /etc/nginx/sites-available/manova ]; then die "port $PUBLIC_PORT is already in use by something else"; fi
if [ -e "$REPO" ]; then
  url="$(git -C "$REPO" remote get-url origin 2>/dev/null || true)"
  [ "$url" = "$REPO_URL" ] || die "$REPO exists but is not a checkout of $REPO_URL"
fi
psql_admin -Atc 'select 1' >/dev/null || die "cannot reach PostgreSQL on port $PG_PORT as postgres"
echo "ok: ports $API_PORT/$WEB_PORT/$PUBLIC_PORT free or already ours, PostgreSQL reachable"

# ---- checkout --------------------------------------------------------------------------------------------
step "checkout $REPO"
if [ ! -d "$REPO/.git" ]; then
  git clone --quiet "$REPO_URL" "$REPO"
  echo "cloned"
else
  echo "already there"
fi
# The default branch has no backend/ folder; put the checkout on `production` so backend/.env has a home.
if [ ! -d "$REPO/backend" ]; then
  git -C "$REPO" fetch --quiet origin "+refs/heads/production:refs/remotes/origin/production"
  git -C "$REPO" checkout --quiet --force --detach origin/production
  echo "checked out origin/production"
fi
mkdir -p "$REPO/.runtime" "$REPO/backend"

# ---- database + backend/.env -----------------------------------------------------------------------------
step "database $DB and backend/.env"
ENV_FILE="$REPO/backend/.env"
if [ -f "$ENV_FILE" ]; then
  echo "backend/.env already exists, database credentials left as they are"
else
  PW="$(openssl rand -hex 24)"
  if [ "$(psql_admin -Atc "select 1 from pg_roles where rolname = '$DB_USER'")" = "1" ]; then
    psql_admin -v pw="$PW" <<SQL
ALTER ROLE $DB_USER LOGIN PASSWORD :'pw';
SQL
    echo "role $DB_USER existed, password reset"
  else
    psql_admin -v pw="$PW" <<SQL
CREATE ROLE $DB_USER LOGIN PASSWORD :'pw';
SQL
    echo "role $DB_USER created"
  fi
  if [ "$(psql_admin -Atc "select 1 from pg_database where datname = '$DB'")" = "1" ]; then
    echo "database $DB already exists, kept"
  else
    psql_admin -c "CREATE DATABASE $DB OWNER $DB_USER ENCODING 'UTF8' TEMPLATE template0"
    psql_admin -c "REVOKE ALL ON DATABASE $DB FROM PUBLIC"
    touch "$REPO/.runtime/SEED_DEMO_PENDING"
    echo "database $DB created (demo data will be seeded by the first deploy)"
  fi
  PGPASSWORD="$PW" psql -h 127.0.0.1 -p "$PG_PORT" -U "$DB_USER" -d "$DB" -X -Atc 'select 1' >/dev/null \
    || die "$DB_USER cannot log in to $DB over 127.0.0.1:$PG_PORT"
  ( umask 077; cat > "$ENV_FILE" <<ENVEOF
# Written by deploy/bootstrap-server.sh. Not in git. Edit here, then: pm2 reload manova-api --update-env
# development = staging mode: demo logins and demo data work. production needs HTTPS and real accounts
# (see docs/manova-finance-implementation/15-RELEASE-AND-CUTOVER.md).
APP_ENV=development
PORT=$API_PORT
DATABASE_URL=postgres://$DB_USER:$PW@127.0.0.1:$PG_PORT/$DB
APP_ORIGINS=$PUBLIC_ORIGIN
SESSION_TTL_HOURS=12
COOKIE_SECURE=false
TRUST_PROXY=false
DEMO_LOGIN=true
PORTAL_LOGIN=false
DEMO_PASSWORD=manova-demo
ENVEOF
  )
  echo "backend/.env written (mode 600)"
fi

# ---- deploy entry point ----------------------------------------------------------------------------------
step "deploy entry point $ENTRY"
install -m 700 "$HERE/ci-entry.sh" "$ENTRY"
echo "installed"

# ---- CI key (optional: only when the operator sent a new public key) -------------------------------------
if [ -f "$HERE/ci-key.pub" ]; then
  step "CI key in ~/.ssh/authorized_keys"
  AK="$HOME/.ssh/authorized_keys"
  PUB="$(awk 'NF>=2 {print $1" "$2; exit}' "$HERE/ci-key.pub")"
  [[ "$PUB" =~ ^ssh-ed25519\ [A-Za-z0-9+/=]+$ ]] || die "ci-key.pub is not an ed25519 public key"
  cp -p "$AK" "$AK.bak-manova-$(date +%Y%m%d-%H%M%S)"
  TMP="$(mktemp "$HOME/.ssh/.ak.XXXXXX")"
  before="$(grep -c . "$AK" || true)"
  removed="$(grep -c " $KEY_COMMENT\$" "$AK" || true)"
  grep -v " $KEY_COMMENT\$" "$AK" > "$TMP" || true
  [ -z "$(tail -c1 "$TMP")" ] || echo >> "$TMP"
  echo "command=\"$ENTRY\",no-pty,no-port-forwarding,no-agent-forwarding,no-X11-forwarding,no-user-rc $PUB $KEY_COMMENT" >> "$TMP"
  after="$(grep -c . "$TMP")"
  [ "$after" -eq $((before - removed + 1)) ] || { rm -f "$TMP"; die "authorized_keys line count check failed, file left untouched"; }
  chmod 600 "$TMP"; mv "$TMP" "$AK"
  echo "added (replaced $removed older MANOVA key line(s)); other keys untouched; backup kept next to the file"
fi

# ---- nginx -----------------------------------------------------------------------------------------------
step "nginx site on :$PUBLIC_PORT"
if sudo -n cmp -s "$HERE/nginx-manova.conf" /etc/nginx/sites-available/manova && [ -L /etc/nginx/sites-enabled/manova ]; then
  echo "already installed"
else
  had_old=""; sudo -n test -e /etc/nginx/sites-available/manova && had_old=1
  [ -n "$had_old" ] && sudo -n cp -p /etc/nginx/sites-available/manova /tmp/manova-nginx.prev
  sudo -n install -m 644 "$HERE/nginx-manova.conf" /etc/nginx/sites-available/manova
  sudo -n ln -sfn /etc/nginx/sites-available/manova /etc/nginx/sites-enabled/manova
  if ! sudo -n nginx -t 2>/tmp/manova-nginx-test.log; then
    cat /tmp/manova-nginx-test.log
    if [ -n "$had_old" ]; then sudo -n cp -p /tmp/manova-nginx.prev /etc/nginx/sites-available/manova
    else sudo -n rm -f /etc/nginx/sites-enabled/manova /etc/nginx/sites-available/manova; fi
    die "nginx config test failed; MANOVA site rolled back, nginx was NOT reloaded"
  fi
  sudo -n systemctl reload nginx
  echo "installed and nginx reloaded (config test passed)"
fi

echo
echo "BOOTSTRAP OK"
