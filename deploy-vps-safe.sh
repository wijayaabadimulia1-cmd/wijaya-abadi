#!/usr/bin/env bash
set -euo pipefail

EXPECTED_VPS_IP="${EXPECTED_VPS_IP:-103.253.213.232}"
DOMAIN="kreditmotorhonda.tech"
SERVICE="kreditmotorhonda-tech.service"
LEGACY_MAIN_SERVICE="kreditmotorhonda-id.service"
GSC_SITE_URLS="${GSC_SITE_URLS:-sc-domain:kreditmotorhonda.tech,sc-domain:solusikreditmotor.cloud}"
SOURCE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMMIT="${DEPLOY_COMMIT:-$(git -C "$SOURCE_DIR" rev-parse --short=12 HEAD)}"
COMMIT="${COMMIT:0:12}"
RELEASE_DIR="/opt/wijaya-abadi/releases/${COMMIT}-$(date -u +%Y%m%d%H%M%S)"
BACKUP_DIR="/var/backups/honda-wijaya-abadi"
DROPIN_DIR="/etc/systemd/system/${SERVICE}.d"
DROPIN_FILE="${DROPIN_DIR}/deploy.conf"
SERVICE_UNIT_FILE="/etc/systemd/system/${SERVICE}"
SATELLITE_SERVICES=("kreditmotorhonda.service" "solusikreditmotor.service" "$LEGACY_MAIN_SERVICE")
SATELLITE_PORTS=(3001 3002 3003)
SATELLITE_DROPIN_FILES=(
  "/etc/systemd/system/kreditmotorhonda.service.d/zz-catalog-release.conf"
  "/etc/systemd/system/solusikreditmotor.service.d/zz-catalog-release.conf"
  "/etc/systemd/system/${LEGACY_MAIN_SERVICE}.d/zz-catalog-release.conf"
)
SATELLITE_DROPIN_EXISTED=(0 0 0)
SATELLITE_DROPIN_BACKUPS=("" "" "")
STAGING_DIR=""
STAGING_PID=""
PREVIOUS_DROPIN_EXISTS=0
PREVIOUS_DROPIN_BACKUP=""
CUTOVER_STARTED=0
DEPLOY_SUCCEEDED=0
SATELLITE_UPDATES_STARTED=0
SERVICE_UNIT_CREATED=0

fail() {
  echo "$*" >&2
  exit 1
}

cleanup() {
  local result=$?
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
    if [ "$SERVICE_UNIT_CREATED" -eq 1 ]; then
      sudo systemctl disable --now "$SERVICE" || true
      if [ "$PREVIOUS_DROPIN_EXISTS" -eq 1 ] && [ -f "$PREVIOUS_DROPIN_BACKUP" ]; then
        sudo install -m 644 "$PREVIOUS_DROPIN_BACKUP" "$DROPIN_FILE"
      else
        sudo rm -f "$DROPIN_FILE"
      fi
      sudo rm -f "$SERVICE_UNIT_FILE"
    else
      if [ "$PREVIOUS_DROPIN_EXISTS" -eq 1 ] && [ -f "$PREVIOUS_DROPIN_BACKUP" ]; then
        sudo install -m 644 "$PREVIOUS_DROPIN_BACKUP" "$DROPIN_FILE"
      else
        sudo rm -f "$DROPIN_FILE"
      fi
      sudo systemctl daemon-reload || true
      if [ "$SERVICE_ENV_SOURCE" = "$SERVICE" ]; then
        sudo systemctl restart "$SERVICE" || true
      else
        sudo systemctl stop "$SERVICE" || true
      fi
    fi
    sudo systemctl daemon-reload || true
  elif [ "$SERVICE_UNIT_CREATED" -eq 1 ] && [ "$DEPLOY_SUCCEEDED" -ne 1 ]; then
    sudo systemctl disable --now "$SERVICE" || true
    if [ "$PREVIOUS_DROPIN_EXISTS" -eq 1 ] && [ -f "$PREVIOUS_DROPIN_BACKUP" ]; then
      sudo install -m 644 "$PREVIOUS_DROPIN_BACKUP" "$DROPIN_FILE"
    else
      sudo rm -f "$DROPIN_FILE"
    fi
    sudo rm -f "$SERVICE_UNIT_FILE"
    sudo systemctl daemon-reload || true
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

SERVICE_ENV_SOURCE="$SERVICE"
if ! systemctl is-active --quiet "$SERVICE"; then
  if systemctl is-active --quiet "$LEGACY_MAIN_SERVICE"; then
    SERVICE_ENV_SOURCE="$LEGACY_MAIN_SERVICE"
  else
    fail "$SERVICE and $LEGACY_MAIN_SERVICE are not active; refusing to replace an unknown production state."
  fi
fi
if [ -e "$DROPIN_FILE" ]; then
  if ! grep -Eq '^WorkingDirectory=/opt/wijaya-abadi/releases/[^[:space:]]+$' "$DROPIN_FILE" \
    || ! grep -Eq '^ExecStart=/usr/bin/node /opt/wijaya-abadi/releases/[^[:space:]]+/dist/server\.cjs$' "$DROPIN_FILE"; then
    fail "$DROPIN_FILE is not a recognized managed deployment; review it before deploying."
  fi
  PREVIOUS_DROPIN_EXISTS=1
fi

SERVICE_ENV="$(systemctl show "$SERVICE_ENV_SOURCE" --property=Environment --value)"
SERVICE_USER="$(systemctl show "$SERVICE_ENV_SOURCE" --property=User --value)"
SERVICE_GROUP="$(systemctl show "$SERVICE_ENV_SOURCE" --property=Group --value)"
SERVICE_USER="${SERVICE_USER:-root}"
SERVICE_GROUP="${SERVICE_GROUP:-$(id -gn "$SERVICE_USER")}"
DATA_DIR="$(printf '%s\n' "$SERVICE_ENV" | sed -n 's/.*DATA_DIR=\([^ ]*\).*/\1/p')"
UPLOADS_DIR="$(printf '%s\n' "$SERVICE_ENV" | sed -n 's/.*UPLOADS_DIR=\([^ ]*\).*/\1/p')"
ENV_FILE="$(systemctl show "$SERVICE_ENV_SOURCE" --property=EnvironmentFiles --value | sed -n 's/^\([^ ]*\).*/\1/p')"

if [ -z "$DATA_DIR" ] || [ -z "$UPLOADS_DIR" ] || [ -z "$ENV_FILE" ]; then
  fail "Could not determine the live DATA_DIR, UPLOADS_DIR, and EnvironmentFile from $SERVICE_ENV_SOURCE."
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
for service in "${SATELLITE_SERVICES[@]}"; do
  if ! systemctl is-active --quiet "$service"; then
    fail "$service is not active; refusing to replace an unknown production state."
  fi
  if [ "$service" = "$LEGACY_MAIN_SERVICE" ] && [ "$SERVICE_ENV_SOURCE" = "$LEGACY_MAIN_SERVICE" ]; then
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
if [ ! -e "$SERVICE_UNIT_FILE" ]; then
  SOURCE_UNIT_FILE="$(systemctl show "$SERVICE_ENV_SOURCE" --property=FragmentPath --value)"
  if [ ! -f "$SOURCE_UNIT_FILE" ]; then
    fail "Could not find the unit file for $SERVICE_ENV_SOURCE to create $SERVICE."
  fi
  sudo install -m 644 "$SOURCE_UNIT_FILE" "$SERVICE_UNIT_FILE"
  SERVICE_UNIT_CREATED=1
fi
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
sudo systemctl enable "$SERVICE"
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
      || ! grep -Eq '^ExecStart=/usr/bin/node /opt/wijaya-abadi/releases/[^[:space:]]+/dist/server\.cjs$' "$dropin_file"; then
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
Environment=PORT=${SATELLITE_PORTS[$index]}
Environment=CATALOG_API_URL=http://127.0.0.1:3000
Environment=CATALOG_OWNER_DATA_FILE=$DATA_DIR/db.json
ExecStart=
ExecStart=/usr/bin/env PORT=${SATELLITE_PORTS[$index]} CATALOG_API_URL=http://127.0.0.1:3000 CATALOG_OWNER_DATA_FILE=$DATA_DIR/db.json /usr/bin/node $RELEASE_DIR/dist/server.cjs
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

DEPLOY_SUCCEEDED=1
CUTOVER_STARTED=0
echo "Deployment complete: $COMMIT"
echo "Catalog records preserved: $live_motors"
echo "Backup: $BACKUP_FILE"
echo "Release: $RELEASE_DIR"