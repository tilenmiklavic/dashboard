#!/usr/bin/env bash
# Deploys dashboard to the netcup server, the same way as every app there:
# check → upload the source → `docker compose up --build` on the server → install site.caddy into the shared proxy.
#
#   DEPLOY_HOST=dashboard@dashboard.miklavic.si bash deploy/deploy.sh               # or dashboard@<server IP> / an ssh alias
# Optional: SSH_PORT (default 22).
#
# On the server, in /opt/dashboard: compose.yml (from deploy/), .env (secrets, by hand, never synced) and src/ (the repo).
set -euo pipefail

cd "$(dirname "$0")/.."

: "${DEPLOY_HOST:?set DEPLOY_HOST, e.g. dashboard@dashboard.miklavic.si}"
APP=dashboard
DIR=/opt/dashboard
SSH="ssh -p ${SSH_PORT:-22} -o BatchMode=yes"

# Fail before changing anything if the server isn't set up for this app.
echo "==> checking $DEPLOY_HOST"
$SSH "$DEPLOY_HOST" bash -s -- "$APP" "$DIR" <<'REMOTE'
{
exec </dev/null
if [ ! -w "$2" ] || [ ! -w /opt/proxy/sites ] || ! docker inspect proxy-caddy-1 >/dev/null 2>&1; then
  echo "error: the server is not set up for $1 (or the shared proxy is not running). As root, run once:" >&2
  echo "  curl -fsSL https://raw.githubusercontent.com/tilenmiklavic/klin-dom/main/deploy/netcup/setup-server.sh | ssh root@<server> 'bash -s -- $1'" >&2
  exit 1
fi
if [ ! -f "$2/.env" ]; then
  echo "error: $2/.env is missing; create it on the server first (see deploy/.env.example)" >&2
  exit 1
fi
}
REMOTE

echo "==> uploading source"
rsync -az --delete -e "$SSH" \
  --exclude .git --exclude node_modules --exclude dist --exclude build --exclude '.env' --exclude '.env.*' \
  --exclude __pycache__ --exclude .venv --exclude coverage \
  ./ "$DEPLOY_HOST:$DIR/src/"
rsync -az -e "$SSH" deploy/compose.yml "$DEPLOY_HOST:$DIR/compose.yml"

echo "==> building and restarting"
$SSH "$DEPLOY_HOST" bash -s -- "$DIR" <<'REMOTE'
{
exec </dev/null
set -euo pipefail
cd "$1"
docker compose up -d --build --remove-orphans --wait
docker image prune -f >/dev/null
docker compose ps
}
REMOTE

echo "==> routing $APP in the shared proxy"
# Install site.caddy as /opt/proxy/sites/$APP.caddy; if the proxy rejects it, put the previous one back.
$SSH "$DEPLOY_HOST" "set -e
  cd /opt/proxy/sites
  umask 002
  [ -f $APP.caddy ] && cp $APP.caddy .$APP.caddy.bak
  cat > .$APP.caddy.new && mv -f .$APP.caddy.new $APP.caddy
  if docker exec proxy-caddy-1 caddy reload --config /etc/caddy/Caddyfile; then
    rm -f .$APP.caddy.bak
  else
    if [ -f .$APP.caddy.bak ]; then mv -f .$APP.caddy.bak $APP.caddy; else rm -f $APP.caddy; fi
    echo 'error: the proxy rejected deploy/site.caddy; the previous route is still live' >&2
    exit 1
  fi" < deploy/site.caddy

echo "Done: https://dashboard.miklavic.si/"
