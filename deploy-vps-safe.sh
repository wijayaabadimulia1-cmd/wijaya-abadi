#!/usr/bin/env bash
set -euo pipefail

if ! sudo -n true >/dev/null 2>&1; then
  echo "ERROR: Passwordless sudo is required for the deployment user. Grant NOPASSWD for sudo on the VPS and retry." >&2
  exit 1
fi

EXPECTED_VPS_IP="${EXPECTED_VPS_IP:-103.253.213.232}"
DOMAIN="kreditmotorhonda.tech"
SERVICE="kreditmotorhonda-tech.service"
GSC_SITE_URLS="${GSC_SITE_URLS:-sc-domain:kreditmotorhonda.tech,sc-domain:solusikreditmotor.cloud}"
SOURCE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMMIT="${DEPLOY_COMMIT:-$(git -C "$SOURCE_DIR" rev-parse --short=12 HEAD)}"
COMMIT="${COMMIT:0:12}"
RELEASE_DIR="/opt/wijaya-abadi/releases/${COMMIT}-$(date -u +%Y%m%d%H%M%S)"
BACKUP_DIR="/var/backups/honda-wijaya-abadi"
DROPIN_DIR="/etc/systemd/system/${SERVICE}.d"
DROPIN_FILE="${DROPIN_DIR}/deploy.conf"
SATELLITE_SERVICES=("kreditmotorhonda.service" "solusikreditmotor.service")
SATELLITE_PORTS=(3001 3002)
SATELLITE_DROPIN_FILES=(
  "/etc/systemd/system/kreditmotorhonda.service.d/zz-catalog-release.conf"
  "/etc/systemd/system/solusikreditmotor.service.d/zz-catalog-release.conf"
)
SATELLITE_DROPIN_EXISTED=(0 0)
SATELLITE_DROPIN_BACKUPS=("" "")
ID_SERVICE="kreditmotorhonda-id.service"
ID_UNIT_FILE="/etc/systemd/system/${ID_SERVICE}"
ID_DATA_DIR="/var/lib/honda-wijaya-abadi/sites/kreditmotorhonda-id/data"
ID_SERVICE_UPDATED=0
ID_SERVICE_WAS_ACTIVE=0
ID_SERVICE_WAS_ENABLED=0
ID_UNIT_BACKUP=""
STAGING_DIR=""
STAGING_PID=""
PREVIOUS_DROPIN_EXISTS=0
PREVIOUS_DROPIN_BACKUP=""
CUTOVER_STARTED=0
DEPLOY_SUCCEEDED=0
SATELLITE_UPDATES_STARTED=0

fail() {
  echo "$*" >&2
  exit 1
}

cleanup() {
  local result=$?
  if [ "$ID_SERVICE_UPDATED" -eq 1 ] && [ "$DEPLOY_SUCCEEDED" -ne 1 ]; then
    echo "Kreditmotorhonda.id deployment failed; restoring its previous service." >&2
    if [ -n "$ID_UNIT_BACKUP" ] && [ -f "$ID_UNIT_BACKUP" ]; then
      sudo install -m 644 "$ID_UNIT_BACKUP" "$ID_UNIT_FILE"
      if [ "$ID_SERVICE_WAS_ENABLED" -eq 1 ]; then
        sudo systemctl enable "$ID_SERVICE" || true
      else
        sudo systemctl disable "$ID_SERVICE" || true
      fi
      sudo systemctl daemon-reload || true
      if [ "$ID_SERVICE_WAS_ACTIVE" -eq 1 ]; then
        sudo systemctl restart "$ID_SERVICE" || true
      else
        sudo systemctl stop "$ID_SERVICE" || true
      fi
    else
      sudo systemctl stop "$ID_SERVICE" || true
      sudo systemctl disable "$ID_SERVICE" || true
      sudo rm -f "$ID_UNIT_FILE"
      sudo systemctl daemon-reload || true
    fi
  fi
  if [ "$SATELLITE_UPDATES_STARTED" -eq 1 ] && [ "$DEPLOY_SUCCEEDED" -ne 1 ]; then
    echo "Satellite catalog deployment failed; restoring previous service releases." >&2
    for index in "${!SATELLITE_SERVICES[@]}"; do
      if [ "${SATELLITE_DROPIN_EXISTED[$index]}" -eq 1 ] && [ -f "${SATELLITE_DROPIN_BACKUPS[$index]}" ]; then
        sudo install -m 644 "${SATELLITE_DROPIN_BACKUPS[$index]}" "${SATELLITE_DROPIN_FILES[$index]}"
      else
        sudo rm -f "${SATELLITE_DROPIN_FILES[$index]}"
      fi
    done
    sudo systemctl daemon-reload || true
    for service in "${SATELLITE_SERVICES[@]}"; do
      sudo systemctl restart "$service" || true
    done
  fi
  if [ "$CUTOVER_STARTED" -eq 1 ] && [ "$DEPLOY_SUCCEEDED" -ne 1 ]; then
    echo "Deployment health check failed; restoring the previous systemd service." >&2
    if [ "$PREVIOUS_DROPIN_EXISTS" -eq 1 ] && [ -f "$PREVIOUS_DROPIN_BACKUP" ]; then
      sudo install -m 644 "$PREVIOUS_DROPIN_BACKUP" "$DROPIN_FILE"
    else
      sudo rm -f "$DROPIN_FILE"
    fi
    sudo systemctl daemon-reload || true
    sudo systemctl restart "$SERVICE" || true
  fi
  if [ "$DEPLOY_SUCCEEDED" -ne 1 ] && [ -d "$RELEASE_DIR" ]; then
    local release_in_use=0
    for service in "$SERVICE" "${SATELLITE_SERVICES[@]}"; do
      if systemctl show "$service" --property=ExecStart --value | grep -Fq -- "$RELEASE_DIR/dist/server.cjs"; then
        release_in_use=1
        break
      fi
    done
    if [ "$release_in_use" -eq 0 ]; then
      sudo rm -rf -- "$RELEASE_DIR" || echo "Warning: could not remove failed release $RELEASE_DIR." >&2
    else
      echo "Preserving failed release still referenced by a service: $RELEASE_DIR" >&2
    fi
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
  if ! grep -Eq '^WorkingDirectory=/opt/wijaya-abadi/releases/[^[:space:]]+$' "$DROPIN_FILE" \
    || ! grep -Eq '^ExecStart=(/usr/bin/node /opt/wijaya-abadi/releases/[^[:space:]]+/dist/server\.cjs|/usr/bin/env([[:space:]]+-u[[:space:]][A-Za-z_][A-Za-z0-9_]*|[[:space:]][A-Za-z_][A-Za-z0-9_]*=[^[:space:]]+)*[[:space:]]+/usr/bin/node /opt/wijaya-abadi/releases/[^[:space:]]+/dist/server\.cjs)$' "$DROPIN_FILE"; then
    fail "$DROPIN_FILE is not a recognized managed deployment; review it before deploying."
  fi
  PREVIOUS_DROPIN_EXISTS=1
fi

SERVICE_ENV="$(systemctl show "$SERVICE" --property=Environment --value)"
SERVICE_USER="$(systemctl show "$SERVICE" --property=User --value)"
SERVICE_GROUP="$(systemctl show "$SERVICE" --property=Group --value)"
SERVICE_USER="${SERVICE_USER:-root}"
SERVICE_GROUP="${SERVICE_GROUP:-$(id -gn "$SERVICE_USER")}"
DATA_DIR="$(printf '%s\n' "$SERVICE_ENV" | sed -n 's/.*DATA_DIR=\([^ ]*\).*/\1/p')"
UPLOADS_DIR="$(printf '%s\n' "$SERVICE_ENV" | sed -n 's/.*UPLOADS_DIR=\([^ ]*\).*/\1/p')"
ENV_FILE="$(systemctl show "$SERVICE" --property=EnvironmentFiles --value | sed -n 's/^\([^ ]*\).*/\1/p')"

if [ -z "$DATA_DIR" ] || [ -z "$UPLOADS_DIR" ] || [ -z "$ENV_FILE" ]; then
  fail "Could not determine the live DATA_DIR, UPLOADS_DIR, and EnvironmentFile from $SERVICE."
fi
if [ ! -s "$DATA_DIR/db.json" ] || [ ! -d "$UPLOADS_DIR" ] || [ ! -f "$ENV_FILE" ]; then
  fail "Live catalog, uploads, or environment file is missing; refusing deployment."
fi

get_service_environment_value() {
  local service="$1"
  local key="$2"
  local value
  local environment_files
  local environment_file

  value="$(systemctl show "$service" --property=Environment --value \
    | tr ' ' '\n' \
    | sed -n "s/^${key}=//p" \
    | head -n 1)"
  if [ -n "$value" ]; then
    printf '%s\n' "$value"
    return
  fi

  environment_files="$(systemctl show "$service" --property=EnvironmentFiles --value \
    | sed 's/ (ignore_errors=[^)]*)//g' \
    | tr ' ' '\n')"
  while IFS= read -r environment_file; do
    [ -n "$environment_file" ] || continue
    value="$(sed -n "s/^${key}=//p" "$environment_file" | head -n 1)"
    if [ -n "$value" ]; then
      printf '%s\n' "$value"
      return
    fi
  done <<< "$environment_files"
}

WIJAYA_DATA_DIR="$(get_service_environment_value kreditmotorhonda.service DATA_DIR)"
SOLUSI_DATA_DIR="$(get_service_environment_value solusikreditmotor.service DATA_DIR)"
ID_SOURCE_DATA_DIR=""
if systemctl is-active --quiet "$ID_SERVICE"; then
  ID_SOURCE_DATA_DIR="$(get_service_environment_value "$ID_SERVICE" DATA_DIR)"
fi
for service in "${SATELLITE_SERVICES[@]}"; do
  if ! systemctl is-active --quiet "$service"; then
    echo "Notice: $service is currently inactive; proceeding with deployment and it will be restarted during cutover." >&2
    continue
  fi
  catalog_api_url="$(get_service_environment_value "$service" CATALOG_API_URL)"
  if [ "$catalog_api_url" != "http://127.0.0.1:3000" ]; then
    fail "$service is not configured to use the main catalog API; refusing deployment."
  fi
done
OWNER_ANALYTICS_WIJAYA_DB_FILE="${OWNER_ANALYTICS_WIJAYA_DB_FILE:-${WIJAYA_DATA_DIR}/db.json}"
OWNER_ANALYTICS_SOLUSI_DB_FILE="${OWNER_ANALYTICS_SOLUSI_DB_FILE:-${SOLUSI_DATA_DIR}/db.json}"
if [ -z "$WIJAYA_DATA_DIR" ] || [ -z "$SOLUSI_DATA_DIR" ] \
  || [ ! -s "$OWNER_ANALYTICS_WIJAYA_DB_FILE" ] \
  || [ ! -s "$OWNER_ANALYTICS_SOLUSI_DB_FILE" ]; then
  fail "Could not verify the Wijaya and Solusi site databases for owner analytics."
fi

EXPECTED_MOTORS="$(node -e 'const db = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")); if (!Array.isArray(db.motors)) process.exit(2); console.log(db.motors.length)' "$DATA_DIR/db.json")"
if [ "$EXPECTED_MOTORS" -lt 1 ]; then
  fail "The live catalog is empty; refusing deployment."
fi

DEPLOY_USER="${SUDO_USER:-$(id -un)}"
DEPLOY_GROUP="$(id -gn "$DEPLOY_USER")"
sudo install -d -o "$DEPLOY_USER" -g "$DEPLOY_GROUP" "$RELEASE_DIR"
if git -C "$SOURCE_DIR" rev-parse --verify HEAD >/dev/null 2>&1; then
  git -C "$SOURCE_DIR" archive --format=tar HEAD | tar -xf - -C "$RELEASE_DIR"
else
  tar -cf - -C "$SOURCE_DIR" . | tar -xf - -C "$RELEASE_DIR"
fi
cd "$RELEASE_DIR"
npm ci
npm run build

sudo install -d -o "$SERVICE_USER" -g "$SERVICE_GROUP" -m 755 "$ID_DATA_DIR"
if [ ! -s "$ID_DATA_DIR/db.json" ]; then
  if [ -z "$ID_SOURCE_DATA_DIR" ] || [ ! -s "$ID_SOURCE_DATA_DIR/db.json" ]; then
    fail "No existing kreditmotorhonda.id database is available to initialize $ID_DATA_DIR; refusing deployment."
  fi
  sudo install -o "$SERVICE_USER" -g "$SERVICE_GROUP" -m 640 "$ID_SOURCE_DATA_DIR/db.json" "$ID_DATA_DIR/db.json"
fi

STAGING_DIR="$(mktemp -d /tmp/wijaya-abadi-deploy.XXXXXX)"
STAGING_PORT="$(node -e 'const net = require("node:net"); const server = net.createServer(); server.listen(0, "127.0.0.1", () => { console.log(server.address().port); server.close(); });')"
if [ "$PREVIOUS_DROPIN_EXISTS" -eq 1 ]; then
  PREVIOUS_DROPIN_BACKUP="$STAGING_DIR/deploy.conf.previous"
  cp "$DROPIN_FILE" "$PREVIOUS_DROPIN_BACKUP"
fi
mkdir -p "$STAGING_DIR/data" "$STAGING_DIR/uploads"
cp "$DATA_DIR/db.json" "$STAGING_DIR/data/db.json"

(
  cd "$RELEASE_DIR"
  exec env NODE_ENV=production HOST=127.0.0.1 PORT="$STAGING_PORT" \
    DATA_DIR="$STAGING_DIR/data" UPLOADS_DIR="$STAGING_DIR/uploads" \
    OWNER_ANALYTICS_WIJAYA_DB_FILE="$OWNER_ANALYTICS_WIJAYA_DB_FILE" \
    OWNER_ANALYTICS_SOLUSI_DB_FILE="$OWNER_ANALYTICS_SOLUSI_DB_FILE" \
    node dist/server.cjs >"$STAGING_DIR/server.log" 2>&1
) &
STAGING_PID=$!

ready=0
for attempt in $(seq 1 30); do
  if curl --silent --fail --output /dev/null --max-time 2 "http://127.0.0.1:${STAGING_PORT}/"; then
    ready=1
    break
  fi
  sleep 1
done
if [ "$ready" -ne 1 ]; then
  tail -80 "$STAGING_DIR/server.log" >&2 || true
  fail "Staged application did not become healthy on port 3101."
fi

staged_motors="$(curl --silent --show-error --fail --max-time 10 "http://127.0.0.1:${STAGING_PORT}/api/motors" | node -e 'let body = ""; process.stdin.on("data", (chunk) => body += chunk).on("end", () => { const motors = JSON.parse(body); if (!Array.isArray(motors)) process.exit(2); console.log(motors.length); });')"
if [ "$staged_motors" != "$EXPECTED_MOTORS" ]; then
  fail "Staged catalog count differs from live data ($staged_motors vs $EXPECTED_MOTORS)."
fi
for path in / /sitemap.xml; do
  status="$(curl --silent --show-error --output /dev/null --write-out '%{http_code}' --max-time 10 "http://127.0.0.1:${STAGING_PORT}${path}")"
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
if ! sudo tar -tzf "$BACKUP_FILE" | grep -Fx 'db.json' > /dev/null; then
  fail "Catalog backup verification failed: $BACKUP_FILE"
fi

if command -v pm2 >/dev/null 2>&1 && pm2 describe honda-wijaya-abadi >/dev/null 2>&1; then
  pm2 stop honda-wijaya-abadi
fi

GSC_CREDENTIALS_DIR="/etc/wijaya-abadi"
GSC_CREDENTIALS_FILE="$GSC_CREDENTIALS_DIR/gsc-service-account.json"
if [ -f "$GSC_CREDENTIALS_FILE" ]; then
  sudo chown "$SERVICE_USER:$SERVICE_GROUP" "$GSC_CREDENTIALS_DIR" "$GSC_CREDENTIALS_FILE"
  sudo chmod 700 "$GSC_CREDENTIALS_DIR"
  sudo chmod 600 "$GSC_CREDENTIALS_FILE"
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
Environment=GSC_SERVICE_ACCOUNT_FILE=/etc/wijaya-abadi/gsc-service-account.json
Environment=GSC_SITE_URLS=$GSC_SITE_URLS
Environment=OWNER_ANALYTICS_WIJAYA_DB_FILE=$OWNER_ANALYTICS_WIJAYA_DB_FILE
Environment=OWNER_ANALYTICS_SOLUSI_DB_FILE=$OWNER_ANALYTICS_SOLUSI_DB_FILE
ExecStart=
ExecStart=/usr/bin/node $RELEASE_DIR/dist/server.cjs
EOF

CUTOVER_STARTED=1
sudo systemctl daemon-reload
sudo systemctl restart "$SERVICE"

if ! systemctl show "$SERVICE" --property=ExecStart --value | grep -F -- "$RELEASE_DIR/dist/server.cjs" > /dev/null; then
  fail "$SERVICE did not start the new release; refusing to validate a different process."
fi

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

for index in "${!SATELLITE_SERVICES[@]}"; do
  service="${SATELLITE_SERVICES[$index]}"
  dropin_file="${SATELLITE_DROPIN_FILES[$index]}"
  if [ -e "$dropin_file" ]; then
    if ! grep -Eq '^WorkingDirectory=/opt/wijaya-abadi/releases/[^[:space:]]+$' "$dropin_file" \
      || ! grep -Eq '^ExecStart=(/usr/bin/node /opt/wijaya-abadi/releases/[^[:space:]]+/dist/server\.cjs|/usr/bin/env([[:space:]]+-u[[:space:]][A-Za-z_][A-Za-z0-9_]*|[[:space:]][A-Za-z_][A-Za-z0-9_]*=[^[:space:]]+)*[[:space:]]+/usr/bin/node /opt/wijaya-abadi/releases/[^[:space:]]+/dist/server\.cjs)$' "$dropin_file"; then
      fail "$dropin_file is not a recognized managed catalog release; review it before deployment."
    fi
    SATELLITE_DROPIN_EXISTED[$index]=1
    SATELLITE_DROPIN_BACKUPS[$index]="$STAGING_DIR/satellite-${index}.previous"
    cp "$dropin_file" "${SATELLITE_DROPIN_BACKUPS[$index]}"
  fi
done

SATELLITE_UPDATES_STARTED=1
for index in "${!SATELLITE_SERVICES[@]}"; do
  dropin_file="${SATELLITE_DROPIN_FILES[$index]}"
  sudo install -d -m 755 "$(dirname "$dropin_file")"
  sudo tee "$dropin_file" >/dev/null <<EOF
[Service]
WorkingDirectory=$RELEASE_DIR
Environment=CATALOG_OWNER_DATA_FILE=$DATA_DIR/db.json
ExecStart=
ExecStart=/usr/bin/node $RELEASE_DIR/dist/server.cjs
EOF
done
sudo systemctl daemon-reload

for index in "${!SATELLITE_SERVICES[@]}"; do
  service="${SATELLITE_SERVICES[$index]}"
  port="${SATELLITE_PORTS[$index]}"
  sudo systemctl restart "$service"
  if ! systemctl is-active --quiet "$service" \
    || ! systemctl show "$service" --property=ExecStart --value | grep -F -- "$RELEASE_DIR/dist/server.cjs" > /dev/null; then
    fail "$service did not start the new catalog release."
  fi

  satellite_ready=0
  for attempt in $(seq 1 30); do
    if curl --silent --fail --output /dev/null --max-time 2 "http://127.0.0.1:${port}/api/health"; then
      satellite_ready=1
      break
    fi
    sleep 1
  done
  if [ "$satellite_ready" -ne 1 ]; then
    fail "$service did not become healthy on port ${port}."
  fi

  satellite_motors="$(curl --silent --show-error --fail --max-time 10 "http://127.0.0.1:${port}/api/motors" | node -e 'let body = ""; process.stdin.on("data", (chunk) => body += chunk).on("end", () => { const motors = JSON.parse(body); if (!Array.isArray(motors)) process.exit(2); console.log(motors.length); });')"
  if [ "$satellite_motors" != "$EXPECTED_MOTORS" ]; then
    fail "$service catalog proxy returned $satellite_motors motors; expected $EXPECTED_MOTORS."
  fi
  echo "${service} catalog verified: ${satellite_motors} motors"
done

if [ -f "$ID_UNIT_FILE" ]; then
  ID_UNIT_BACKUP="$STAGING_DIR/kreditmotorhonda-id.service.previous"
  sudo cp "$ID_UNIT_FILE" "$ID_UNIT_BACKUP"
  if systemctl is-active --quiet "$ID_SERVICE"; then ID_SERVICE_WAS_ACTIVE=1; fi
  if systemctl is-enabled --quiet "$ID_SERVICE"; then ID_SERVICE_WAS_ENABLED=1; fi
fi
ID_SERVICE_UPDATED=1
sudo tee "$ID_UNIT_FILE" >/dev/null <<EOF
[Unit]
Description=Honda Wijaya Abadi kreditmotorhonda.id site
After=network.target

[Service]
Type=simple
User=$SERVICE_USER
Group=$SERVICE_GROUP
WorkingDirectory=$RELEASE_DIR
EnvironmentFile=
EnvironmentFile=$ENV_FILE
Environment=NODE_ENV=production
Environment=HOST=127.0.0.1
Environment=PORT=3003
Environment=APP_URL=https://kreditmotorhonda.id
Environment=DATA_DIR=$ID_DATA_DIR
Environment=UPLOADS_DIR=$UPLOADS_DIR
Environment=CATALOG_API_URL=http://127.0.0.1:3000
Environment=CATALOG_OWNER_DATA_FILE=$DATA_DIR/db.json
Environment=CATALOG_ADMIN_URL=https://kreditmotorhonda.tech/admin
ExecStart=
ExecStart=/usr/bin/node $RELEASE_DIR/dist/server.cjs
Restart=on-failure
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF
sudo systemctl daemon-reload
sudo systemctl reset-failed "$ID_SERVICE" || true
sudo systemctl stop "$ID_SERVICE" || true
sudo pkill -f "server\.cjs.*3003|PORT=3003" || true
sudo systemctl enable "$ID_SERVICE"
sudo systemctl restart "$ID_SERVICE"
if ! systemctl is-active --quiet "$ID_SERVICE" \
  || ! systemctl show "$ID_SERVICE" --property=ExecStart --value | grep -F -- "$RELEASE_DIR/dist/server.cjs" > /dev/null; then
  fail "$ID_SERVICE did not start the new release."
fi

id_site_ready=0
for attempt in $(seq 1 30); do
  if curl --silent --fail --output /dev/null --max-time 2 http://127.0.0.1:3003/api/health; then
    id_site_ready=1
    break
  fi
  sleep 1
done
if [ "$id_site_ready" -ne 1 ]; then
  fail "$ID_SERVICE did not become healthy on port 3003."
fi
id_site_motors="$(curl --silent --show-error --fail --max-time 10 http://127.0.0.1:3003/api/motors | node -e 'let body = ""; process.stdin.on("data", (chunk) => body += chunk).on("end", () => { const motors = JSON.parse(body); if (!Array.isArray(motors)) process.exit(2); console.log(motors.length); });')"
if [ "$id_site_motors" != "$EXPECTED_MOTORS" ]; then
  fail "$ID_SERVICE catalog proxy returned $id_site_motors motors; expected $EXPECTED_MOTORS."
fi
echo "$ID_SERVICE catalog verified: $id_site_motors motors"

DEPLOY_SUCCEEDED=1
CUTOVER_STARTED=0
echo "Deployment complete: $COMMIT"
echo "Catalog records preserved: $live_motors"
echo "Backup: $BACKUP_FILE"
echo "Release: $RELEASE_DIR"