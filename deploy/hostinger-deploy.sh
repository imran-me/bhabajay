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

# Database: apply database/schema.sql + the seeds listed in database/seed/manifest.txt
# (fetched from main; all statements are idempotent). Credentials: $HOME/bhabajay-deploy/db.env.
DBENV="$HOME/bhabajay-deploy/db.env"
RAW="https://raw.githubusercontent.com/imran-me/bhabajay/main/database"
db_sync() {
  [ -f "$DBENV" ] || return 0
  local db user pass tmp cnf sum
  db=$(sed -n 's/^DB_DATABASE=//p' "$DBENV" | tr -d '\r"'"'"); user=$(sed -n 's/^DB_USERNAME=//p' "$DBENV" | tr -d '\r"'"'")
  pass=$(sed -n 's/^DB_PASSWORD=//p' "$DBENV" | tr -d '\r')
  [ -n "$db" ] && [ -n "$user" ] && [ -n "$pass" ] || return 0
  tmp=$(mktemp -d) || return 0
  curl -fsSL "$RAW/schema.sql" -o "$tmp/0.sql" || { rm -rf "$tmp"; return 0; }
  local i=1
  for f in $(curl -fsSL "$RAW/seed/manifest.txt" 2>/dev/null | tr -d '\r' | grep -E '^[A-Za-z0-9_.-]+\.sql$'); do
    curl -fsSL "$RAW/seed/$f" -o "$tmp/$i.sql" && i=$((i+1))
  done
  sum=$(cat "$tmp"/*.sql | sha1sum | cut -c1-40)
  if [ "$sum" != "$(cat "$HOME/bhabajay-deploy/.db-sum" 2>/dev/null)" ]; then
    cnf="$tmp/my.cnf"; umask 077
    printf '[client]\nuser=%s\npassword="%s"\nhost=localhost\ndefault-character-set=utf8mb4\n' "$user" "$pass" > "$cnf"
    local ok=1 s
    for s in $(ls "$tmp"/*.sql | sort -V); do mysql --defaults-extra-file="$cnf" "$db" < "$s" >> "$LOG" 2>&1 || { ok=0; break; }; done
    if [ "$ok" = 1 ]; then
      echo "$sum" > "$HOME/bhabajay-deploy/.db-sum"; echo "$(date '+%F %T') db synced (${sum:0:7})" >> "$LOG"
    else
      echo "$(date '+%F %T') db sync FAILED" >> "$LOG"
    fi
  fi
  rm -rf "$tmp"
}
# first run, and every 5 minutes (GitHub raw files are cached ~5 min after a merge)
if [ ! -f "$HOME/bhabajay-deploy/.db-sum" ] || [ $((10#$(date +%M) % 5)) -eq 0 ]; then db_sync; fi

# Media inbox: zips uploaded to $HOME/bhabajay-deploy/media-inbox/ are unpacked into
# public_html/media/ (images/video live on the server, never in git), then moved to media-inbox/done/.
INBOX="$HOME/bhabajay-deploy/media-inbox"
mkdir -p "$INBOX/done" "$WEB/media"
for z in "$INBOX"/*.zip; do
  [ -f "$z" ] || continue
  # only media file types are extracted (no php/html/htaccess can arrive this way)
  if unzip -o -q -C "$z" '*.webp' '*.jpg' '*.jpeg' '*.png' '*.svg' '*.mp4' '*.webm' '*.vtt' -x '__MACOSX/*' -d "$WEB/media" >> "$LOG" 2>&1; then
    mv "$z" "$INBOX/done/" && echo "$(date '+%F %T') media unpacked $(basename "$z")" >> "$LOG"
  else
    echo "$(date '+%F %T') media unzip FAILED $(basename "$z")" >> "$LOG"
  fi
done

remote=$(git ls-remote "$REPO" "refs/heads/$BRANCH" | cut -f1)
[ -n "$remote" ] || exit 0
[ -d "$GIT_DIR" ] || git init -q --bare "$GIT_DIR"
current=$(git --git-dir="$GIT_DIR" rev-parse -q --verify "refs/heads/$BRANCH" 2>/dev/null || true)
[ "$remote" = "$current" ] && [ -f "$WEB/index.html" ] && exit 0

git --git-dir="$GIT_DIR" fetch -q --depth 1 "$REPO" "+refs/heads/$BRANCH:refs/heads/$BRANCH"
git --git-dir="$GIT_DIR" --work-tree="$WEB" checkout -q -f "$BRANCH" -- .
echo "$(date '+%F %T') deployed ${remote:0:7}" >> "$LOG"
db_sync
