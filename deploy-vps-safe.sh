#!/usr/bin/env bash
set -euo pipefail

EXPECTED_VPS_IP="${EXPECTED_VPS_IP:-103.253.213.232}"
DOMAIN="kreditmotorhonda.tech"
SERVICE="kreditmotorhonda.service"
SOURCE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMMIT="$(git -C "$SOURCE_DIR" rev-parse --short=12 HEAD)"
RELEASE_DIR="/opt/wijaya-abadi/releases/${COMMIT}-$(date -u +%Y%m%d%H%M%S)"
BACKUP_DIR="/var/backups/honda-wijaya-abadi"
DROPIN_DIR="/etc/systemd/system/${SERVICE}.d"
DROPIN_FILE="${DROPIN_DIR}/deploy.conf"
STAGING_DIR=""
STAGING_PID=""
CUTOVER_STARTED=0
DEPLOY_SUCCEEDED=0

fail() {
  echo "$*" >&2
  exit 1
}

cleanup() {
  local result=$?
  if [ "$CUTOVER_STARTED" -eq 1 ] && [ "$DEPLOY_SUCCEEDED" -ne 1 ]; then
    echo "Deployment health check failed; restoring the previous systemd service." >&2
    sudo rm -f "$DROPIN_FILE"
    sudo systemctl daemon-reload || true
    sudo systemctl restart "$SERVICE" || true
  fi
  if [ -n "$STAGING_PID" ]; then
    kill "$STAGING_PID" 2>/dev/null || true
    wait "$STAGING_PID" 2>/dev/null || true
  fi
  if [ -n "$STAGING_DIR" ]; then
    rm -rf "$STAGING_DIR"
  fi
  exit "$result"
}
trap cleanup EXIT

for host in "$DOMAIN" "www.${DOMAIN}"; do
  resolved_ips="$(getent ahostsv4 "$host" | awk '{print $1}' | sort -u || true)"
  if [ "$resolved_ips" != "$EXPECTED_VPS_IP" ]; then
    fail "DNS preflight failed for $host: expected only $EXPECTED_VPS_IP, got '${resolved_ips:-no IPv4 address}'."
  fi
done

if ! systemctl is-active --quiet "$SERVICE"; then
  fail "$SERVICE is not active; refusing to replace an unknown production state."
fi
if [ -e "$DROPIN_FILE" ]; then
  fail "$DROPIN_FILE already exists; review the current override before deploying."
fi

SERVICE_ENV="$(systemctl show "$SERVICE" --property=Environment --value)"
DATA_DIR="$(printf '%s\n' "$SERVICE_ENV" | sed -n 's/.*DATA_DIR=\([^ ]*\).*/\1/p')"
UPLOADS_DIR="$(printf '%s\n' "$SERVICE_ENV" | sed -n 's/.*UPLOADS_DIR=\([^ ]*\).*/\1/p')"
ENV_FILE="$(systemctl show "$SERVICE" --property=EnvironmentFiles --value | sed -n 's/^\([^ ]*\).*/\1/p')"

if [ -z "$DATA_DIR" ] || [ -z "$UPLOADS_DIR" ] || [ -z "$ENV_FILE" ]; then
  fail "Could not determine the live DATA_DIR, UPLOADS_DIR, and EnvironmentFile from $SERVICE."
fi
if [ ! -s "$DATA_DIR/db.json" ] || [ ! -d "$UPLOADS_DIR" ] || [ ! -f "$ENV_FILE" ]; then
  fail "Live catalog, uploads, or environment file is missing; refusing deployment."
fi

EXPECTED_MOTORS="$(node -e 'const db = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")); if (!Array.isArray(db.motors)) process.exit(2); console.log(db.motors.length)' "$DATA_DIR/db.json")"
if [ "$EXPECTED_MOTORS" -lt 1 ]; then
  fail "The live catalog is empty; refusing deployment."
fi

DEPLOY_USER="${SUDO_USER:-$(id -un)}"
DEPLOY_GROUP="$(id -gn "$DEPLOY_USER")"
sudo install -d -o "$DEPLOY_USER" -g "$DEPLOY_GROUP" "$RELEASE_DIR"
git -C "$SOURCE_DIR" archive --format=tar HEAD | tar -xf - -C "$RELEASE_DIR"
cd "$RELEASE_DIR"
npm ci
npm run build

STAGING_DIR="$(mktemp -d /tmp/wijaya-abadi-deploy.XXXXXX)"
mkdir -p "$STAGING_DIR/data" "$STAGING_DIR/uploads"
cp "$DATA_DIR/db.json" "$STAGING_DIR/data/db.json"

(
  cd "$RELEASE_DIR"
  exec env NODE_ENV=production HOST=127.0.0.1 PORT=3101 \
    DATA_DIR="$STAGING_DIR/data" UPLOADS_DIR="$STAGING_DIR/uploads" \
    node dist/server.cjs >"$STAGING_DIR/server.log" 2>&1
) &
STAGING_PID=$!

ready=0
for attempt in $(seq 1 30); do
  if curl --silent --fail --output /dev/null --max-time 2 http://127.0.0.1:3101/; then
    ready=1
    break
  fi
  sleep 1
done
if [ "$ready" -ne 1 ]; then
  tail -80 "$STAGING_DIR/server.log" >&2 || true
  fail "Staged application did not become healthy on port 3101."
fi

staged_motors="$(curl --silent --show-error --fail --max-time 10 http://127.0.0.1:3101/api/motors | node -e 'let body = ""; process.stdin.on("data", (chunk) => body += chunk).on("end", () => { const motors = JSON.parse(body); if (!Array.isArray(motors)) process.exit(2); console.log(motors.length); });')"
if [ "$staged_motors" != "$EXPECTED_MOTORS" ]; then
  fail "Staged catalog count differs from live data ($staged_motors vs $EXPECTED_MOTORS)."
fi
for path in / /sitemap.xml; do
  status="$(curl --silent --show-error --output /dev/null --write-out '%{http_code}' --max-time 10 "http://127.0.0.1:3101${path}")"
  if [ "$status" != "200" ]; then
    fail "Staged endpoint returned HTTP $status: ${path}"
  fi
done
kill "$STAGING_PID"
wait "$STAGING_PID" 2>/dev/null || true
STAGING_PID=""

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
BACKUP_FILE="${BACKUP_DIR}/catalog-uploads-${STAMP}.tar.gz"
sudo install -d -m 700 "$BACKUP_DIR"
sudo tar -czf "$BACKUP_FILE" -C "$DATA_DIR" db.json -C "$UPLOADS_DIR" .
sudo chmod 600 "$BACKUP_FILE"
if ! sudo tar -tzf "$BACKUP_FILE" | grep -Fxq 'db.json'; then
  fail "Catalog backup verification failed: $BACKUP_FILE"
fi

sudo install -d -m 755 "$DROPIN_DIR"
sudo tee "$DROPIN_FILE" >/dev/null <<EOF
[Service]
WorkingDirectory=$RELEASE_DIR
EnvironmentFile=
EnvironmentFile=$ENV_FILE
Environment=NODE_ENV=production
Environment=HOST=127.0.0.1
Environment=PORT=3000
Environment=APP_URL=https://$DOMAIN
Environment=DATA_DIR=$DATA_DIR
Environment=UPLOADS_DIR=$UPLOADS_DIR
ExecStart=
ExecStart=/usr/bin/node $RELEASE_DIR/dist/server.cjs
EOF

CUTOVER_STARTED=1
sudo systemctl daemon-reload
sudo systemctl restart "$SERVICE"

check_http_200() {
  local url="$1"
  local status
  status="$(curl --silent --show-error --output /dev/null --write-out '%{http_code}' --location --max-time 30 "$url")" || {
    echo "Request failed: $url" >&2
    return 1
  }
  if [ "$status" != "200" ]; then
    echo "Expected HTTP 200, received HTTP $status: $url" >&2
    return 1
  fi
  echo "HTTP $status: $url"
}

for attempt in $(seq 1 30); do
  if curl --silent --fail --output /dev/null --max-time 2 http://127.0.0.1:3000/; then
    break
  fi
  if [ "$attempt" -eq 30 ]; then
    fail "Production service did not become healthy on port 3000."
  fi
  sleep 1
done

live_motors="$(curl --silent --show-error --fail --max-time 10 http://127.0.0.1:3000/api/motors | node -e 'let body = ""; process.stdin.on("data", (chunk) => body += chunk).on("end", () => { const motors = JSON.parse(body); if (!Array.isArray(motors)) process.exit(2); console.log(motors.length); });')"
if [ "$live_motors" != "$EXPECTED_MOTORS" ] || [ ! -s "$DATA_DIR/db.json" ]; then
  fail "Production catalog verification failed ($live_motors vs $EXPECTED_MOTORS)."
fi
check_http_200 "https://${DOMAIN}/"
check_http_200 "https://${DOMAIN}/sitemap.xml"

DEPLOY_SUCCEEDED=1
CUTOVER_STARTED=0
echo "Deployment complete: $COMMIT"
echo "Catalog records preserved: $live_motors"
echo "Backup: $BACKUP_FILE"
echo "Release: $RELEASE_DIR"