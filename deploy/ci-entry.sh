#!/usr/bin/env bash
# Entry point for deploys on the server. Installed OUTSIDE the checkout as ~/project/manova-ci-entry.sh by
# deploy/bootstrap-server.sh, and set as the forced command of the GitHub Actions SSH key, so that key can
# do exactly one thing: deploy a commit that is already on the `production` branch.
#
#   ssh <user>@<host> <40-char-sha>          (from GitHub Actions; arrives as SSH_ORIGINAL_COMMAND)
#   ~/project/manova-ci-entry.sh <sha>       (by hand on the server)
set -Eeuo pipefail

REPO="${MANOVA_REPO_DIR:-$HOME/project/manova}"
BRANCH="${MANOVA_BRANCH:-production}"
LOG="${MANOVA_DEPLOY_LOG:-$HOME/project/manova-deploy.log}"
SHA="${SSH_ORIGINAL_COMMAND:-${1:-}}"

if [[ ! "$SHA" =~ ^[0-9a-f]{40}$ ]]; then
  echo "manova deploy: expected a 40-character commit SHA, got: '${SHA:0:60}'" >&2
  exit 2
fi

exec > >(tee -a "$LOG") 2>&1
echo
echo "===== $(date '+%F %T %Z') deploy $SHA ====="

# One deploy at a time; a second one waits (up to 15 min) instead of clashing.
exec 9>"$HOME/project/.manova-deploy.lock"
flock -w 900 9 || { echo "another deploy is still running after 15 minutes, giving up"; exit 75; }

cd "$REPO"
git fetch --quiet --prune origin "+refs/heads/$BRANCH:refs/remotes/origin/$BRANCH"
if ! git merge-base --is-ancestor "$SHA" "origin/$BRANCH"; then
  echo "refusing: $SHA is not on origin/$BRANCH"
  exit 3
fi
git checkout --quiet --force --detach "$SHA"
exec bash deploy/server-deploy.sh
