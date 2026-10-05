#!/usr/bin/env bash
# Builds and (re)starts MANOVA from the commit currently checked out. Run on the server by deploy/ci-entry.sh.
# Monorepo-aware: a package is only reinstalled/rebuilt when it changed since the last successful deploy.
# Only touches this checkout and the PM2 apps manova-api / manova-web.
set -Eeuo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUNTIME="$ROOT/.runtime"
export PATH="$HOME/.bun/bin:$PATH"
export CI=true
export MANOVA_API_PORT="${MANOVA_API_PORT:-4110}"
export MANOVA_WEB_PORT="${MANOVA_WEB_PORT:-4111}"

step() { echo; echo "--> $*"; }
die() { echo "DEPLOY FAILED: $*" >&2; exit 1; }

mkdir -p "$RUNTIME"
NEW_SHA="$(git -C "$ROOT" rev-parse HEAD)"
OLD_SHA="$(cat "$RUNTIME/DEPLOYED_SHA" 2>/dev/null || true)"

# True when <path> differs between the last deployed commit and this one (or when that cannot be told).
changed() {
  [ -n "$OLD_SHA" ] || return 0
  git -C "$ROOT" cat-file -e "$OLD_SHA^{commit}" 2>/dev/null || return 0
  ! git -C "$ROOT" diff --quiet "$OLD_SHA" "$NEW_SHA" -- "$1"
}

[ -f "$ROOT/backend/.env" ] || die "backend/.env is missing (created once by deploy/bootstrap-server.sh)"
command -v bun >/dev/null || die "bun not found in PATH"
command -v pnpm >/dev/null || die "pnpm not found in PATH"
command -v pm2 >/dev/null || die "pm2 not found in PATH"

echo "commit: ${OLD_SHA:-<first deploy>} -> $NEW_SHA"
echo "bun $(bun --version), node $(node --version), pnpm $(pnpm --version)"

# ---- backend ---------------------------------------------------------------------------------------------
cd "$ROOT/backend"
if changed backend || [ ! -d node_modules ]; then
  step "backend: install dependencies"
  bun install --frozen-lockfile --production
else
  step "backend: unchanged, dependencies kept"
fi
step "backend: database migrations"
bun run db:migrate

# One-time demo data, requested by the bootstrap script with a marker file. Refused by the app in production.
if [ -f "$RUNTIME/SEED_DEMO_PENDING" ]; then
  step "backend: seed demo data (first deploy only)"
  bun run db:seed:demo
  bun run db:seed:finance-demo
  rm -f "$RUNTIME/SEED_DEMO_PENDING"
fi

# ---- frontend --------------------------------------------------------------------------------------------
cd "$ROOT/frontend"
if changed frontend || [ ! -f "$RUNTIME/frontend/server/index.mjs" ]; then
  step "frontend: install dependencies"
  pnpm install --frozen-lockfile
  step "frontend: build"
  pnpm build
  [ -f .output/server/index.mjs ] || die "frontend build produced no .output/server/index.mjs"
  # Swap the finished build in, so the running site never serves a half-written one.
  rm -rf "$RUNTIME/frontend.new" "$RUNTIME/frontend.old"
  cp -a .output "$RUNTIME/frontend.new"
  [ -d "$RUNTIME/frontend" ] && mv "$RUNTIME/frontend" "$RUNTIME/frontend.old"
  mv "$RUNTIME/frontend.new" "$RUNTIME/frontend"
  rm -rf "$RUNTIME/frontend.old"
else
  step "frontend: unchanged, previous build kept"
fi

# ---- processes -------------------------------------------------------------------------------------------
step "pm2: start or reload manova-api and manova-web"
cd "$ROOT"
if changed deploy/ecosystem.config.cjs; then
  # A reload keeps the old script/interpreter, so a changed process definition needs a fresh start.
  pm2 delete manova-api manova-web >/dev/null 2>&1 || true
  pm2 start deploy/ecosystem.config.cjs
else
  pm2 startOrReload deploy/ecosystem.config.cjs --update-env
fi
pm2 save >/dev/null

step "health check"
ok=""
for _ in $(seq 1 40); do
  if curl -fs -o /dev/null "http://127.0.0.1:$MANOVA_API_PORT/health" \
     && curl -fs -o /dev/null "http://127.0.0.1:$MANOVA_WEB_PORT/api/v1/health" \
     && curl -fs -o /dev/null "http://127.0.0.1:$MANOVA_WEB_PORT/login"; then
    ok=1; break
  fi
  sleep 1
done
if [ -z "$ok" ]; then
  pm2 logs manova-api --nostream --lines 40 || true
  pm2 logs manova-web --nostream --lines 40 || true
  die "services did not become healthy within 40s (the previous commit is NOT restored automatically)"
fi
curl -fsS "http://127.0.0.1:$MANOVA_WEB_PORT/api/v1/health" | head -c 400; echo

echo "$NEW_SHA" > "$RUNTIME/DEPLOYED_SHA"
echo
echo "DEPLOY OK: $NEW_SHA"
