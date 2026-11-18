#!/usr/bin/env bash
# Hostinger cron (every minute):
#   /bin/bash -c 'D=$HOME/bhabajay-deploy; mkdir -p $D && curl -fsSL https://raw.githubusercontent.com/imran-me/bhabajay/main/deploy/hostinger-deploy.sh -o $D/.new && bash -n $D/.new && mv $D/.new $D/deploy.sh; bash $D/deploy.sh'
# Pulls the built `deploy` branch into bhabajay.com's own web root only.
# Touches nothing outside domains/bhabajay.com/public_html. Never deletes files.
set -euo pipefail
REPO="https://github.com/imran-me/bhabajay.git"
BRANCH="deploy"
WEB="$HOME/domains/bhabajay.com/public_html"
GIT_DIR="$HOME/bhabajay-deploy/repo.git"
LOG="$HOME/bhabajay-deploy/deploy.log"
LOCK="$HOME/bhabajay-deploy/.lock"

[ -d "$WEB" ] || { echo "$(date) web root missing: $WEB" >> "$LOG"; exit 1; }
exec 9>"$LOCK"; flock -n 9 || exit 0

remote=$(git ls-remote "$REPO" "refs/heads/$BRANCH" | cut -f1)
[ -n "$remote" ] || exit 0
[ -d "$GIT_DIR" ] || git init -q --bare "$GIT_DIR"
current=$(git --git-dir="$GIT_DIR" rev-parse -q --verify "refs/heads/$BRANCH" 2>/dev/null || true)
[ "$remote" = "$current" ] && [ -f "$WEB/index.html" ] && exit 0

git --git-dir="$GIT_DIR" fetch -q --depth 1 "$REPO" "+refs/heads/$BRANCH:refs/heads/$BRANCH"
git --git-dir="$GIT_DIR" --work-tree="$WEB" checkout -q -f "$BRANCH" -- .
echo "$(date '+%F %T') deployed ${remote:0:7}" >> "$LOG"
