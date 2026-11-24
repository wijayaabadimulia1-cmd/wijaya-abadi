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
ALLOW_EMPTY_CATALOG="${ALLOW_EMPTY_CATALOG:-false}"
SOURCE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -n "${DEPLOY_COMMIT:-}" ]; then
  COMMIT="${DEPLOY_COMMIT}"
elif git -C "$SOURCE_DIR" rev-parse --verify HEAD >/dev/null 2>&1; then
  COMMIT="$(git -C "$SOURCE_DIR" rev-parse --short=12 HEAD)"
else
  COMMIT="unknown"
fi
COMMIT="${COMMIT:0:12}"
RELEASE_DIR="/opt/wijaya-abadi/releases/${COMMIT}-$(date -u +%Y%m%d%H%M%S)"
BACKUP_DIR="/var/backups/honda-wijaya-abadi"
DROPIN_DIR="/etc/systemd/system/${SERVICE}.d"
DROPIN_FILE="${DROPIN_DIR}/zzzzzzzz-wijaya-abadi-deploy.conf"
SATELLITE_SERVICES=("kreditmotorhonda.service" "solusikreditmotor.service")
SATELLITE_PORTS=(3001 3002)
SATELLITE_PM2_NAMES=("wijaya-kreditmotor" "solusi-kreditmotor")
SATELLITE_DROPIN_FILES=(
  "/etc/systemd/system/kreditmotorhonda.service.d/zzzzzzzz-wijaya-abadi-catalog.conf"
  "/etc/systemd/system/solusikreditmotor.service.d/zzzzzzzz-wijaya-abadi-catalog.conf"
)
SATELLITE_DROPIN_EXISTED=(0 0)
SATELLITE_DROPIN_BACKUPS=("" "")
SATELLITE_SERVICE_PRESENT=(0 0)
SATELLITE_PM2_PRESENT=(0 0)
for index in "${!SATELLITE_SERVICES[@]}"; do
  service="${SATELLITE_SERVICES[$index]}"
  load_state="$(systemctl show "$service" --property=LoadState --value 2>/dev/null || true)"
  if [ "$load_state" = "loaded" ]; then
    SATELLITE_SERVICE_PRESENT[$index]=1
  else
    process_name="${SATELLITE_PM2_NAMES[$index]}"
    if command -v pm2 >/dev/null 2>&1 && pm2 describe "$process_name" >/dev/null 2>&1; then
      SATELLITE_PM2_PRESENT[$index]=1
      echo "Notice: $service unit is not installed; $process_name will be updated through PM2."
    else
      echo "ERROR: $service is not installed and PM2 process $process_name is unavailable; refusing to skip this site." >&2
      exit 1
    fi
  fi
done
ID_SERVICE="kreditmotorhonda-id.service"
ID_UNIT_FILE="/etc/systemd/system/${ID_SERVICE}"
ID_DROPIN_DIR="/etc/systemd/system/${ID_SERVICE}.d"
ID_DEPLOY_DROPIN="${ID_DROPIN_DIR}/zzzzzzzz-wijaya-abadi-deploy.conf"
ID_DATA_DIR="/var/lib/honda-wijaya-abadi/sites/kreditmotorhonda-id/data"
ID_PM2_NAME="kreditmotorhonda-id"
ID_PM2_PRESENT=0
ID_PM2_REMOVED=0
ID_PM2_PREVIOUS_RELEASE=""
ID_PM2_CATALOG_TOKEN=""
if command -v pm2 >/dev/null 2>&1 && pm2 describe "$ID_PM2_NAME" >/dev/null 2>&1; then
  ID_PM2_PRESENT=1
fi
ID_SERVICE_UPDATED=0
ID_SERVICE_WAS_ACTIVE=0
ID_SERVICE_WAS_ENABLED=0
ID_UNIT_BACKUP=""
ID_DROPIN_BACKUP=""
ID_DROPIN_EXISTED=0
STAGING_DIR=""
STAGING_PID=""
PREVIOUS_DROPIN_EXISTS=0
PREVIOUS_DROPIN_BACKUP=""
CUTOVER_STARTED=0
DEPLOY_SUCCEEDED=0
SATELLITE_UPDATES_STARTED=0
SATELLITE_PM2_UPDATES_STARTED=0
SITE_SERVICES_UPDATED=0
PM2_PREVIOUS_RELEASE=""
PM2_SITE_NAMES=()
PM2_CATALOG_TOKEN=""
CATALOG_SHARED_TOKEN=""
CATALOG_TOKEN_ENV_FILE="/etc/wijaya-abadi/catalog-service-token.env"
CATALOG_TOKEN_ENV_BACKUP=""
CATALOG_TOKEN_ENV_EXISTED=0
CATALOG_TOKEN_ENV_UPDATED=0

fail() {
  echo "$*" >&2
  exit 1
}

cleanup() {
  local result=$?
  if [ "$CATALOG_TOKEN_ENV_UPDATED" -eq 1 ] \
    && [ "$DEPLOY_SUCCEEDED" -ne 1 ] && [ "$SITE_SERVICES_UPDATED" -ne 1 ]; then
    if [ "$CATALOG_TOKEN_ENV_EXISTED" -eq 1 ] && [ -f "$CATALOG_TOKEN_ENV_BACKUP" ]; then
      sudo install -m 600 "$CATALOG_TOKEN_ENV_BACKUP" "$CATALOG_TOKEN_ENV_FILE"
    else
      sudo rm -f "$CATALOG_TOKEN_ENV_FILE"
    fi
  fi
  if [ "$ID_SERVICE_UPDATED" -eq 1 ] && [ "$DEPLOY_SUCCEEDED" -ne 1 ] && [ "$SITE_SERVICES_UPDATED" -ne 1 ]; then
    echo "Kreditmotorhonda.id deployment failed; restoring its previous service." >&2
    if [ -n "$ID_UNIT_BACKUP" ] && [ -f "$ID_UNIT_BACKUP" ]; then
      sudo install -m 644 "$ID_UNIT_BACKUP" "$ID_UNIT_FILE"
      if [ "$ID_DROPIN_EXISTED" -eq 1 ] && [ -f "$ID_DROPIN_BACKUP" ]; then
        sudo install -m 644 "$ID_DROPIN_BACKUP" "$ID_DEPLOY_DROPIN"
      else
        sudo rm -f "$ID_DEPLOY_DROPIN"
      fi
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
      sudo rm -f "$ID_DEPLOY_DROPIN"
      sudo rm -f "$ID_UNIT_FILE"
      sudo systemctl daemon-reload || true
    fi
  fi
  if [ "$ID_PM2_REMOVED" -eq 1 ] \
    && { [ "$ID_SERVICE_WAS_ACTIVE" -ne 1 ] || [ -z "$ID_UNIT_BACKUP" ]; }; then
    echo "Restoring the previous PM2-managed kreditmotorhonda.id process." >&2
    if [ -n "$ID_PM2_PREVIOUS_RELEASE" ] && [ -f "$ID_PM2_PREVIOUS_RELEASE/ecosystem.config.cjs" ] \
      && [[ "$ID_PM2_CATALOG_TOKEN" =~ ^[a-fA-F0-9]{64}$ ]]; then
      HWA_PM2_SITE_NAMES="$ID_PM2_NAME" CATALOG_SERVICE_TOKEN="$ID_PM2_CATALOG_TOKEN" \
        pm2 start "$ID_PM2_PREVIOUS_RELEASE/ecosystem.config.cjs" --update-env || true
    else
      echo "Warning: previous PM2-managed .id release could not be restored safely." >&2
    fi
  fi
  if [ "$SATELLITE_UPDATES_STARTED" -eq 1 ] && [ "$DEPLOY_SUCCEEDED" -ne 1 ] && [ "$SITE_SERVICES_UPDATED" -ne 1 ]; then
    echo "Satellite catalog deployment failed; restoring previous service releases." >&2
    for index in "${!SATELLITE_SERVICES[@]}"; do
      if [ "${SATELLITE_SERVICE_PRESENT[$index]}" -ne 1 ]; then
        continue
      fi
      if [ "${SATELLITE_DROPIN_EXISTED[$index]}" -eq 1 ] && [ -f "${SATELLITE_DROPIN_BACKUPS[$index]}" ]; then
        sudo install -m 644 "${SATELLITE_DROPIN_BACKUPS[$index]}" "${SATELLITE_DROPIN_FILES[$index]}"
      else
        sudo rm -f "${SATELLITE_DROPIN_FILES[$index]}"
      fi
    done
    sudo systemctl daemon-reload || true
    for index in "${!SATELLITE_SERVICES[@]}"; do
      if [ "${SATELLITE_SERVICE_PRESENT[$index]}" -ne 1 ]; then
        continue
      fi
      service="${SATELLITE_SERVICES[$index]}"
      sudo systemctl restart "$service" || true
    done
  fi
  if [ "$SATELLITE_PM2_UPDATES_STARTED" -eq 1 ] && [ "$DEPLOY_SUCCEEDED" -ne 1 ] && [ "$SITE_SERVICES_UPDATED" -ne 1 ]; then
    echo "PM2 satellite deployment failed; restoring its previous release." >&2
    if [ -n "$PM2_PREVIOUS_RELEASE" ] && [ -f "$PM2_PREVIOUS_RELEASE/ecosystem.config.cjs" ]; then
      rollback_config="$STAGING_DIR/pm2-rollback.config.cjs"
      cat > "$rollback_config" <<'EOF'
const config = require(process.env.HWA_PM2_ROLLBACK_CONFIG);
const names = new Set(String(process.env.HWA_PM2_SITE_NAMES || '').split(',').filter(Boolean));
const apps = config.apps.filter(({ name }) => names.has(name));
if (apps.length !== names.size) throw new Error('Could not restore every PM2 satellite process.');
module.exports = { apps };
EOF
for process_name in "${PM2_SITE_NAMES[@]}"; do
  pm2 delete "$process_name" || true
done
      HWA_PM2_ROLLBACK_CONFIG="$PM2_PREVIOUS_RELEASE/ecosystem.config.cjs" \
        HWA_PM2_SITE_NAMES="$(IFS=,; echo "${PM2_SITE_NAMES[*]}")" \
        CATALOG_SERVICE_TOKEN="$PM2_CATALOG_TOKEN" \
  pm2 start "$rollback_config" --update-env || true
    else
      echo "Warning: previous PM2 release could not be determined; leaving the new PM2 process configuration in place." >&2
    fi
  fi
  if [ "$ID_PM2_REMOVED" -eq 1 ] && [ "$DEPLOY_SUCCEEDED" -ne 1 ]; then
    pm2 save || true
  fi
  if [ "$CUTOVER_STARTED" -eq 1 ] && [ "$DEPLOY_SUCCEEDED" -ne 1 ] && [ "$SITE_SERVICES_UPDATED" -ne 1 ]; then
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
    if [ "$release_in_use" -eq 0 ] && command -v pm2 >/dev/null 2>&1 \
      && pm2 jlist 2>/dev/null | grep -Fq -- "$RELEASE_DIR"; then
      release_in_use=1
    fi
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

for host in "$DOMAIN" "www.${DOMAIN}" "wijaya.kreditmotorhonda.tech" "solusikreditmotor.cloud" "www.solusikreditmotor.cloud"; do
  resolved_ips="$(getent ahostsv4 "$host" | awk '{print $1}' | sort -u || true)"
  if [ "$resolved_ips" != "$EXPECTED_VPS_IP" ]; then
    fail "DNS preflight failed for $host: expected only $EXPECTED_VPS_IP, got '${resolved_ips:-no IPv4 address}'."
  fi
done
ID_DNS_READY=1
for host in "kreditmotorhonda.id" "www.kreditmotorhonda.id"; do
  resolved_ips="$(getent ahostsv4 "$host" | awk '{print $1}' | sort -u || true)"
  if [ "$resolved_ips" != "$EXPECTED_VPS_IP" ]; then
    ID_DNS_READY=0
    echo "Notice: DNS for $host is not ready; the .id service will be verified locally and public checks skipped."
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
ENV_FILE="$(systemctl show "$SERVICE" --property=EnvironmentFiles --value | sed -n 's/^\([^ ]*\).*/\1/p' | head -n 1)"

if [ -z "$DATA_DIR" ] || [ -z "$UPLOADS_DIR" ]; then
  fail "Could not determine the live DATA_DIR and UPLOADS_DIR from $SERVICE."
fi
if [ -n "$ENV_FILE" ] && [ ! -f "$ENV_FILE" ]; then
  fail "The configured environment file is missing; refusing deployment."
fi
if [ ! -s "$DATA_DIR/db.json" ] || [ ! -d "$UPLOADS_DIR" ]; then
  fail "Live catalog or uploads are missing; refusing deployment."
fi
ENV_FILE_DIRECTIVE=""
if [ -n "$ENV_FILE" ]; then
  ENV_FILE_DIRECTIVE="EnvironmentFile=$ENV_FILE"
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

get_pm2_catalog_service_token() {
  local process_names="$1"
  pm2 jlist | node -e '
    let input = "";
    process.stdin.on("data", (chunk) => input += chunk).on("end", () => {
      try {
        const names = process.argv[1].split(",").filter(Boolean);
        const apps = JSON.parse(input);
        const tokens = names.map((name) => {
          const app = apps.find((item) => item.name === name);
          return app?.pm2_env?.env?.CATALOG_SERVICE_TOKEN;
        });
        if (!tokens.length || tokens.some((token) => typeof token !== "string" || !/^[a-f0-9]{64}$/i.test(token))) {
          process.exit(1);
        }
        if (new Set(tokens).size !== 1) process.exit(1);
        process.stdout.write(tokens[0]);
      } catch {
        process.exit(1);
      }
    });
  ' "$process_names"
}

PM2_TOKEN_SOURCE_NAMES=()
for index in "${!SATELLITE_PM2_PRESENT[@]}"; do
  if [ "${SATELLITE_PM2_PRESENT[$index]}" -eq 1 ]; then
    PM2_TOKEN_SOURCE_NAMES+=("${SATELLITE_PM2_NAMES[$index]}")
  fi
done
if [ "$ID_PM2_PRESENT" -eq 1 ]; then
  PM2_TOKEN_SOURCE_NAMES+=("$ID_PM2_NAME")
fi
system_catalog_token="$(get_service_environment_value "$SERVICE" CATALOG_SERVICE_TOKEN)"
satellite_catalog_token=""
if [ "${#PM2_TOKEN_SOURCE_NAMES[@]}" -gt 0 ]; then
  PM2_TOKEN_SOURCE_NAMES_CSV="$(IFS=,; echo "${PM2_TOKEN_SOURCE_NAMES[*]}")"
  satellite_catalog_token="$(get_pm2_catalog_service_token "$PM2_TOKEN_SOURCE_NAMES_CSV" || true)"
fi
if [[ "$system_catalog_token" =~ ^[a-fA-F0-9]{64}$ ]]; then
  if [[ "$satellite_catalog_token" =~ ^[a-fA-F0-9]{64}$ ]] \
    && [ "$system_catalog_token" != "$satellite_catalog_token" ]; then
    fail "Systemd and PM2 satellite catalog service tokens do not match."
  fi
  CATALOG_SHARED_TOKEN="$system_catalog_token"
else
  CATALOG_SHARED_TOKEN="$satellite_catalog_token"
fi
if ! [[ "$CATALOG_SHARED_TOKEN" =~ ^[a-fA-F0-9]{64}$ ]]; then
  fail "Could not load a valid CATALOG_SERVICE_TOKEN for shared catalog proxy services."
fi
PM2_CATALOG_TOKEN="$CATALOG_SHARED_TOKEN"

OWNER_ANALYTICS_ROOT_DIR="$(get_service_environment_value "$SERVICE" OWNER_ANALYTICS_ROOT_DIR)"
OWNER_ANALYTICS_ROOT_DIR="${OWNER_ANALYTICS_ROOT_DIR:-$(dirname "$DATA_DIR")}"
WIJAYA_DATA_DIR="$(get_service_environment_value kreditmotorhonda.service DATA_DIR)"
WIJAYA_DATA_DIR="${WIJAYA_DATA_DIR:-${OWNER_ANALYTICS_ROOT_DIR}/sites/wijaya/data}"
SOLUSI_DATA_DIR="$(get_service_environment_value solusikreditmotor.service DATA_DIR)"
SOLUSI_DATA_DIR="${SOLUSI_DATA_DIR:-${OWNER_ANALYTICS_ROOT_DIR}/sites/solusi/data}"
ID_SOURCE_DATA_DIR=""
if systemctl is-active --quiet "$ID_SERVICE"; then
  ID_SOURCE_DATA_DIR="$(get_service_environment_value "$ID_SERVICE" DATA_DIR)"
fi
for index in "${!SATELLITE_SERVICES[@]}"; do
  if [ "${SATELLITE_SERVICE_PRESENT[$index]}" -ne 1 ]; then
    continue
  fi
  service="${SATELLITE_SERVICES[$index]}"
  if ! systemctl is-active --quiet "$service"; then
    echo "Notice: $service is currently inactive; proceeding with deployment and it will be restarted during cutover." >&2
    continue
  fi
  catalog_api_url="$(get_service_environment_value "$service" CATALOG_API_URL)"
  if [ "$catalog_api_url" != "https://kreditmotorhonda.tech" ]; then
    fail "$service is not configured to use the main catalog API; refusing deployment."
  fi
done
OWNER_ANALYTICS_WIJAYA_DB_FILE="${OWNER_ANALYTICS_WIJAYA_DB_FILE:-$(get_service_environment_value "$SERVICE" OWNER_ANALYTICS_WIJAYA_DB_FILE)}"
OWNER_ANALYTICS_WIJAYA_DB_FILE="${OWNER_ANALYTICS_WIJAYA_DB_FILE:-${WIJAYA_DATA_DIR}/db.json}"
OWNER_ANALYTICS_SOLUSI_DB_FILE="${OWNER_ANALYTICS_SOLUSI_DB_FILE:-$(get_service_environment_value "$SERVICE" OWNER_ANALYTICS_SOLUSI_DB_FILE)}"
OWNER_ANALYTICS_SOLUSI_DB_FILE="${OWNER_ANALYTICS_SOLUSI_DB_FILE:-${SOLUSI_DATA_DIR}/db.json}"
if [ -z "$WIJAYA_DATA_DIR" ] || [ -z "$SOLUSI_DATA_DIR" ] \
  || [ ! -s "$OWNER_ANALYTICS_WIJAYA_DB_FILE" ] \
  || [ ! -s "$OWNER_ANALYTICS_SOLUSI_DB_FILE" ]; then
  fail "Could not verify the Wijaya and Solusi site databases for owner analytics."
fi

CATALOG_RESTORE_FILE="$SOURCE_DIR/data/catalog-transfer-2026-10-21.json"
CATALOG_RESTORE_SCRIPT="$SOURCE_DIR/scripts/import-catalog.mjs"
CATALOG_RESTORE_MARKER="$DATA_DIR/.catalog-2026-10-21-imported"
if [ "$ALLOW_EMPTY_CATALOG" = "true" ] && [ -s "$CATALOG_RESTORE_FILE" ] && [ ! -e "$CATALOG_RESTORE_MARKER" ]; then
  CURRENT_MOTORS="$(node -e 'const db = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")); if (!Array.isArray(db.motors)) process.exit(2); console.log(db.motors.length)' "$DATA_DIR/db.json")"
  if [ "$CURRENT_MOTORS" -eq 0 ]; then
    if [ ! -s "$CATALOG_RESTORE_SCRIPT" ]; then
      fail "Catalog backup is present but its import script is missing."
    fi
    echo "Restoring the 2026-10-21 catalog backup because the live catalog is empty."
    NODE_BIN="$(command -v node)"
    sudo "$NODE_BIN" "$CATALOG_RESTORE_SCRIPT" "$CATALOG_RESTORE_FILE" "$DATA_DIR/db.json"
    printf '2026-10-21\n' | sudo tee "$CATALOG_RESTORE_MARKER" >/dev/null
    sudo chmod 600 "$CATALOG_RESTORE_MARKER"
  else
    echo "Live catalog already contains $CURRENT_MOTORS motors; skipping backup restore."
  fi
fi

EXPECTED_MOTORS="$(node -e 'const db = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")); if (!Array.isArray(db.motors)) process.exit(2); console.log(db.motors.length)' "$DATA_DIR/db.json")"
if [ "$EXPECTED_MOTORS" -lt 1 ] && [ "$ALLOW_EMPTY_CATALOG" != "true" ]; then
  fail "The live catalog is empty; refusing deployment."
fi
if [ "$EXPECTED_MOTORS" -lt 1 ]; then
  echo "Notice: deployment explicitly allows the empty catalog."
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
EXPECTED_BUNDLE_PATH="$(grep -oE 'src="/assets/index-[^"]+\.js"' "$RELEASE_DIR/dist/index.html" | head -n 1 | sed 's/^src="//;s/"$//')"
if [ -z "$EXPECTED_BUNDLE_PATH" ]; then
  fail "Could not determine the built frontend bundle from dist/index.html."
fi

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
for path in / /sitemap.xml /owner-dashboard; do
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
$ENV_FILE_DIRECTIVE
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
  systemctl show "$SERVICE" --property=FragmentPath --property=DropInPaths --property=ExecStart --no-pager >&2 || true
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

check_bundle_version() {
  local url="$1"
  local html
  local served_bundle
  html="$(curl --silent --show-error --fail --location --max-time 30 "$url")" || {
    echo "Could not inspect frontend bundle: $url" >&2
    return 1
  }
  if ! grep -Fq -- "$EXPECTED_BUNDLE_PATH" <<< "$html"; then
    served_bundle="$(grep -oE 'src="/assets/index-[^"]+\.js"' <<< "$html" | head -n 1 | sed 's/^src="//;s/"$//' || true)"
    echo "Expected frontend bundle $EXPECTED_BUNDLE_PATH, received ${served_bundle:-no bundle}: $url" >&2
    return 1
  fi
  echo "Frontend bundle verified ($EXPECTED_BUNDLE_PATH): $url"
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
check_bundle_version "http://127.0.0.1:3000/"
check_http_200 "https://${DOMAIN}/"
check_http_200 "https://${DOMAIN}/sitemap.xml"
check_http_200 "https://${DOMAIN}/owner-dashboard"
check_http_200 "https://wijaya.kreditmotorhonda.tech/"
check_http_200 "https://www.solusikreditmotor.cloud/"
if [ "$ID_DNS_READY" -eq 1 ]; then
  check_http_200 "https://kreditmotorhonda.id/"
  check_http_200 "https://www.kreditmotorhonda.id/"
fi

for index in "${!SATELLITE_SERVICES[@]}"; do
  if [ "${SATELLITE_SERVICE_PRESENT[$index]}" -ne 1 ]; then
    continue
  fi
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
sudo install -d -m 700 "$(dirname "$CATALOG_TOKEN_ENV_FILE")"
if [ -e "$CATALOG_TOKEN_ENV_FILE" ]; then
  CATALOG_TOKEN_ENV_BACKUP="$STAGING_DIR/catalog-service-token.env.previous"
  sudo cp "$CATALOG_TOKEN_ENV_FILE" "$CATALOG_TOKEN_ENV_BACKUP"
  CATALOG_TOKEN_ENV_EXISTED=1
fi
sudo install -m 600 /dev/null "$CATALOG_TOKEN_ENV_FILE"
sudo tee "$CATALOG_TOKEN_ENV_FILE" >/dev/null <<EOF
CATALOG_SERVICE_TOKEN=$CATALOG_SHARED_TOKEN
EOF
CATALOG_TOKEN_ENV_UPDATED=1
sudo chmod 600 "$CATALOG_TOKEN_ENV_FILE"
for index in "${!SATELLITE_SERVICES[@]}"; do
  if [ "${SATELLITE_SERVICE_PRESENT[$index]}" -ne 1 ]; then
    continue
  fi
  dropin_file="${SATELLITE_DROPIN_FILES[$index]}"
  port="${SATELLITE_PORTS[$index]}"
  sudo install -d -m 755 "$(dirname "$dropin_file")"
  sudo tee "$dropin_file" >/dev/null <<EOF
[Service]
WorkingDirectory=$RELEASE_DIR
Environment=CATALOG_API_URL=https://kreditmotorhonda.tech
  EnvironmentFile=$CATALOG_TOKEN_ENV_FILE
Environment=CATALOG_OWNER_DATA_FILE=$DATA_DIR/db.json
ExecStart=
ExecStart=/usr/bin/env PORT=$port /usr/bin/node $RELEASE_DIR/dist/server.cjs
EOF
done
sudo systemctl daemon-reload

for index in "${!SATELLITE_SERVICES[@]}"; do
  if [ "${SATELLITE_SERVICE_PRESENT[$index]}" -ne 1 ]; then
    continue
  fi
  service="${SATELLITE_SERVICES[$index]}"
  port="${SATELLITE_PORTS[$index]}"
  sudo systemctl restart "$service"
  if ! systemctl is-active --quiet "$service" \
    || ! systemctl show "$service" --property=ExecStart --value | grep -F -- "$RELEASE_DIR/dist/server.cjs" > /dev/null; then
    systemctl show "$service" --property=FragmentPath --property=DropInPaths --property=ExecStart --no-pager >&2 || true
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

for index in "${!SATELLITE_PM2_PRESENT[@]}"; do
  if [ "${SATELLITE_PM2_PRESENT[$index]}" -eq 1 ]; then
    PM2_SITE_NAMES+=("${SATELLITE_PM2_NAMES[$index]}")
  fi
done
if [ "${#PM2_SITE_NAMES[@]}" -gt 0 ]; then
  PM2_SITE_NAMES_CSV="$(IFS=,; echo "${PM2_SITE_NAMES[*]}")"
  PM2_PREVIOUS_RELEASE="$(pm2 jlist | node -e '
    let input = "";
    process.stdin.on("data", (chunk) => input += chunk).on("end", () => {
      const names = process.argv[1].split(",");
      const apps = JSON.parse(input);
      const selected = names.map((name) => apps.find((app) => app.name === name));
      if (selected.some((app) => !app || app.pm2_env.status !== "online")) process.exit(1);
      const directories = [...new Set(selected.map((app) => app.pm2_env.pm_cwd))];
      if (directories.length !== 1) process.exit(1);
      process.stdout.write(directories[0]);
    });
  ' "$PM2_SITE_NAMES_CSV")" || fail "Could not determine one healthy previous PM2 satellite release for rollback."
  if [ ! -f "$PM2_PREVIOUS_RELEASE/ecosystem.config.cjs" ]; then
    fail "Previous PM2 release does not contain ecosystem.config.cjs; refusing an unsafe satellite update."
  fi
  PM2_CATALOG_TOKEN="$CATALOG_SHARED_TOKEN"
  if ! [[ "$PM2_CATALOG_TOKEN" =~ ^[a-fA-F0-9]{64}$ ]]; then
    fail "Could not load a valid CATALOG_SERVICE_TOKEN for PM2-managed satellite sites."
  fi
  mkdir -p "$RELEASE_DIR/logs"
  SATELLITE_PM2_UPDATES_STARTED=1
  for process_name in "${PM2_SITE_NAMES[@]}"; do
    pm2 delete "$process_name"
  done
  HWA_PM2_SITE_NAMES="$PM2_SITE_NAMES_CSV" CATALOG_SERVICE_TOKEN="$PM2_CATALOG_TOKEN" \
    pm2 start "$RELEASE_DIR/ecosystem.config.cjs" --update-env
  for index in "${!SATELLITE_PM2_PRESENT[@]}"; do
    if [ "${SATELLITE_PM2_PRESENT[$index]}" -ne 1 ]; then
      continue
    fi
    port="${SATELLITE_PORTS[$index]}"
    pm2_ready=0
    for attempt in $(seq 1 30); do
      if curl --silent --fail --output /dev/null --max-time 2 "http://127.0.0.1:${port}/api/health"; then
        pm2_ready=1
        break
      fi
      sleep 1
    done
    if [ "$pm2_ready" -ne 1 ]; then
      fail "PM2 process ${SATELLITE_PM2_NAMES[$index]} did not become healthy on port ${port}."
    fi
    pm2_bundle="$(curl --silent --show-error --fail --max-time 10 "http://127.0.0.1:${port}/" | grep -oE 'src="/assets/index-[^"]+\.js"' | head -n 1 | sed 's/^src="//;s/"$//')"
    if [ "$pm2_bundle" != "$EXPECTED_BUNDLE_PATH" ]; then
      fail "PM2 process ${SATELLITE_PM2_NAMES[$index]} serves ${pm2_bundle:-no bundle}; expected $EXPECTED_BUNDLE_PATH."
    fi
  done
  pm2 jlist | node -e '
    let input = "";
    process.stdin.on("data", (chunk) => input += chunk).on("end", () => {
      const expectedDirectory = process.argv[1];
      const names = process.argv[2].split(",");
      const apps = JSON.parse(input);
      for (const name of names) {
        const app = apps.find((item) => item.name === name);
        if (!app || app.pm2_env.status !== "online" || app.pm2_env.pm_cwd !== expectedDirectory) process.exit(1);
      }
    });
  ' "$RELEASE_DIR" "$PM2_SITE_NAMES_CSV" || fail "PM2 satellite processes did not move to the new release."
  echo "PM2 satellite bundles verified: $PM2_SITE_NAMES_CSV"
fi

if [ -f "$ID_UNIT_FILE" ]; then
  ID_UNIT_BACKUP="$STAGING_DIR/kreditmotorhonda-id.service.previous"
  sudo cp "$ID_UNIT_FILE" "$ID_UNIT_BACKUP"
  if systemctl is-active --quiet "$ID_SERVICE"; then ID_SERVICE_WAS_ACTIVE=1; fi
  if systemctl is-enabled --quiet "$ID_SERVICE"; then ID_SERVICE_WAS_ENABLED=1; fi
fi
if [ -f "$ID_DEPLOY_DROPIN" ]; then
  ID_DROPIN_BACKUP="$STAGING_DIR/kreditmotorhonda-id-deploy.conf.previous"
  sudo cp "$ID_DEPLOY_DROPIN" "$ID_DROPIN_BACKUP"
  ID_DROPIN_EXISTED=1
fi
if [ "$ID_PM2_PRESENT" -eq 1 ]; then
  ID_PM2_PREVIOUS_RELEASE="$(pm2 jlist | node -e '
    let input = "";
    process.stdin.on("data", (chunk) => input += chunk).on("end", () => {
      const app = JSON.parse(input).find((item) => item.name === process.argv[1]);
      if (!app || app.pm2_env.status !== "online" || !app.pm2_env.pm_cwd) process.exit(1);
      process.stdout.write(app.pm2_env.pm_cwd);
    });
  ' "$ID_PM2_NAME")" || fail "Could not determine the previous PM2-managed .id release."
  if [ ! -f "$ID_PM2_PREVIOUS_RELEASE/ecosystem.config.cjs" ]; then
    fail "Previous PM2-managed .id release is missing ecosystem.config.cjs; refusing to remove it."
  fi
  ID_PM2_CATALOG_TOKEN="$(get_pm2_catalog_service_token "$ID_PM2_NAME" || true)"
  ID_PM2_CATALOG_TOKEN="${ID_PM2_CATALOG_TOKEN:-$CATALOG_SHARED_TOKEN}"
  if ! [[ "$ID_PM2_CATALOG_TOKEN" =~ ^[a-fA-F0-9]{64}$ ]]; then
    fail "Could not preserve a valid CATALOG_SERVICE_TOKEN for the PM2-managed .id process."
  fi
  ID_PM2_REMOVED=1
  pm2 delete "$ID_PM2_NAME"
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
$ENV_FILE_DIRECTIVE
Environment=NODE_ENV=production
EnvironmentFile=$CATALOG_TOKEN_ENV_FILE
Environment=HOST=127.0.0.1
Environment=PORT=3003
Environment=APP_URL=https://kreditmotorhonda.id
Environment=DATA_DIR=$ID_DATA_DIR
Environment=UPLOADS_DIR=$UPLOADS_DIR
Environment=CATALOG_API_URL=https://kreditmotorhonda.tech
Environment=CATALOG_OWNER_DATA_FILE=$DATA_DIR/db.json
Environment=CATALOG_ADMIN_URL=https://kreditmotorhonda.tech/admin
ExecStart=
ExecStart=/usr/bin/node $RELEASE_DIR/dist/server.cjs
Restart=on-failure
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF
sudo install -d -m 755 "$ID_DROPIN_DIR"
sudo tee "$ID_DEPLOY_DROPIN" >/dev/null <<EOF
[Service]
WorkingDirectory=$RELEASE_DIR
Environment=CATALOG_API_URL=https://kreditmotorhonda.tech
Environment=CATALOG_OWNER_DATA_FILE=$DATA_DIR/db.json
ExecStart=
ExecStart=/usr/bin/node $RELEASE_DIR/dist/server.cjs
EOF
sudo systemctl daemon-reload
sudo systemctl reset-failed "$ID_SERVICE" || true
sudo systemctl stop "$ID_SERVICE" || true
sudo systemctl enable "$ID_SERVICE"
sudo systemctl restart "$ID_SERVICE"
if ! systemctl is-active --quiet "$ID_SERVICE" \
  || ! systemctl show "$ID_SERVICE" --property=ExecStart --value | grep -F -- "$RELEASE_DIR/dist/server.cjs" > /dev/null; then
  systemctl show "$ID_SERVICE" --property=FragmentPath --property=DropInPaths --property=ExecStart --no-pager >&2 || true
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
id_site_motors="$(curl --silent --show-error --max-time 10 http://127.0.0.1:3003/api/motors | node -e '
  let body = "";
  process.stdin.on("data", (chunk) => body += chunk).on("end", () => {
    let response;
    try {
      response = JSON.parse(body);
    } catch {
      console.error("Kreditmotorhonda.id catalog API returned invalid JSON.");
      process.exit(2);
    }
    if (!Array.isArray(response)) {
      const message = typeof response?.error === "string" ? response.error : "API did not return a motor list.";
      console.error(`Kreditmotorhonda.id catalog API error: ${message}`);
      process.exit(2);
    }
    console.log(response.length);
  });
')"
if [ "$id_site_motors" != "$EXPECTED_MOTORS" ]; then
  fail "$ID_SERVICE catalog proxy returned $id_site_motors motors; expected $EXPECTED_MOTORS."
fi
echo "$ID_SERVICE catalog verified: $id_site_motors motors"
check_bundle_version "http://127.0.0.1:3003/"

for index in "${!SATELLITE_SERVICES[@]}"; do
  if [ "${SATELLITE_SERVICE_PRESENT[$index]}" -ne 1 ]; then
    continue
  fi
  check_bundle_version "http://127.0.0.1:${SATELLITE_PORTS[$index]}/"
done

SITE_SERVICES_UPDATED=1
if [ "$SATELLITE_PM2_UPDATES_STARTED" -eq 1 ] || [ "$ID_PM2_REMOVED" -eq 1 ]; then
  pm2 save
fi
check_bundle_version "https://${DOMAIN}/"
if [ "$ID_DNS_READY" -eq 1 ]; then
  check_bundle_version "https://kreditmotorhonda.id/"
  check_bundle_version "https://www.kreditmotorhonda.id/"
fi
check_bundle_version "https://www.${DOMAIN}/"
check_bundle_version "https://wijaya.kreditmotorhonda.tech/"
check_bundle_version "https://www.solusikreditmotor.cloud/"

DEPLOY_SUCCEEDED=1
CUTOVER_STARTED=0
echo "Deployment complete: $COMMIT"
echo "Catalog records preserved: $live_motors"
echo "Backup: $BACKUP_FILE"
echo "Release: $RELEASE_DIR"
