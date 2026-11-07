#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  sudo bash create-sales-counter-site-full.sh <root-domain> <subdomain> [port] [email]

Examples:
  sudo bash create-sales-counter-site-full.sh kreditmotorhonda.id rudi 3003 admin@kreditmotorhonda.id
  sudo bash create-sales-counter-site-full.sh kreditmotorhonda.tech wijaya 3003 admin@kreditmotorhonda.tech

Environment variables:
  CLOUDFLARE_API_TOKEN   Cloudflare API token with Zone:DNS:Edit
  CLOUDFLARE_ZONE_ID     Cloudflare zone id for the root domain
  DNS_TARGET_IP          Optional manual IP used for the A record
  CERTBOT_EMAIL          Optional email for Let's Encrypt
  DRY_RUN=1              Only print the actions without executing them

Notes:
  - If Cloudflare env vars are unset, the script still creates the nginx site and
    tries certbot, but DNS creation is skipped with a warning.
  - This is a one-shot provision flow for a sales-counter subdomain.
EOF
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

ROOT_DOMAIN="${1:-kreditmotorhonda.id}"
SUBDOMAIN="${2:-rudi}"
PORT="${3:-3003}"
CERTBOT_EMAIL="${4:-${CERTBOT_EMAIL:-admin@${ROOT_DOMAIN}}}"
DRY_RUN="${DRY_RUN:-0}"
HOST="${SUBDOMAIN}.${ROOT_DOMAIN}"
SITE_AVAILABLE="/etc/nginx/sites-available/${HOST}"
SITE_ENABLED="/etc/nginx/sites-enabled/${HOST}"
DNS_TARGET_IP="${DNS_TARGET_IP:-}"
CLOUDFLARE_API_TOKEN="${CLOUDFLARE_API_TOKEN:-}"
CLOUDFLARE_ZONE_ID="${CLOUDFLARE_ZONE_ID:-}"

if [[ -z "${SUBDOMAIN}" || "${SUBDOMAIN}" == "@" ]]; then
  usage
  echo "Error: subdomain cannot be empty." >&2
  exit 1
fi

if [[ "${EUID}" -ne 0 ]]; then
  echo "Please run this as root or with sudo." >&2
  exit 1
fi

run_cmd() {
  local description="$1"
  shift

  echo "==> ${description}"
  if [[ "${DRY_RUN}" == "1" ]]; then
    echo "DRY RUN: $*"
    return 0
  fi
  "$@"
}

create_dns_record_cloudflare() {
  if [[ -z "${CLOUDFLARE_API_TOKEN}" || -z "${CLOUDFLARE_ZONE_ID}" ]]; then
    echo "Warning: CLOUDFLARE_API_TOKEN and CLOUDFLARE_ZONE_ID are not configured. Skipping DNS record creation."
    echo "Set them before running the script to enable automatic DNS creation."
    return 0
  fi

  local ip="${DNS_TARGET_IP:-}"
  if [[ -z "${ip}" ]]; then
    ip="$(curl -fsSL https://api.ipify.org 2>/dev/null || true)"
  fi

  if [[ -z "${ip}" ]]; then
    echo "Error: could not determine the public IP for DNS A record creation." >&2
    return 1
  fi

  local payload
  payload=$(python3 - "$SUBDOMAIN" "$ip" <<'PY'
import json, sys
name = sys.argv[1]
content = sys.argv[2]
print(json.dumps({
    "type": "A",
    "name": name,
    "content": content,
    "ttl": 300,
    "proxied": False,
}))
PY
)

  local response_file
  response_file=$(mktemp)
  if ! curl -fsS -X POST "https://api.cloudflare.com/client/v4/zones/${CLOUDFLARE_ZONE_ID}/dns_records" \
    -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
    -H "Content-Type: application/json" \
    --data "${payload}" > "${response_file}" 2>/dev/null; then
    echo "Failed to create Cloudflare DNS record for ${HOST}." >&2
    cat "${response_file}" >&2 || true
    rm -f "${response_file}"
    return 1
  fi

  rm -f "${response_file}"
  echo "DNS A record created for ${HOST} -> ${ip}"
}

create_nginx_site() {
  mkdir -p /etc/nginx/sites-available /etc/nginx/sites-enabled

  cat > "${SITE_AVAILABLE}" <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name ${HOST};

    return 301 https://\$host\$request_uri;
}

server {
    listen 443 ssl;
    listen [::]:443 ssl;
    server_name ${HOST};

    ssl_certificate /etc/letsencrypt/live/${HOST}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${HOST}/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    client_max_body_size 100m;

    location / {
        proxy_pass http://127.0.0.1:${PORT};
        proxy_http_version 1.1;

        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;

        proxy_connect_timeout 60s;
        proxy_send_timeout 120s;
        proxy_read_timeout 120s;
    }
}
EOF

  ln -sf "${SITE_AVAILABLE}" "${SITE_ENABLED}"
}

run_certbot() {
  if ! command -v certbot >/dev/null 2>&1; then
    echo "Error: certbot is not installed. Install it first:"
    echo "  apt-get update && apt-get install -y certbot python3-certbot-nginx"
    return 1
  fi

  if [[ "${DRY_RUN}" == "1" ]]; then
    echo "DRY RUN: certbot --nginx -d ${HOST} --non-interactive --agree-tos -m ${CERTBOT_EMAIL}"
    return 0
  fi

  certbot --nginx -d "${HOST}" --non-interactive --agree-tos -m "${CERTBOT_EMAIL}"
}

echo "Provisioning sales-counter site: ${HOST}"
echo "Root domain: ${ROOT_DOMAIN}"
echo "Backend port: ${PORT}"
echo "Email: ${CERTBOT_EMAIL}"

action_step=0

run_cmd "Create DNS record for ${HOST}" create_dns_record_cloudflare
run_cmd "Create nginx site for ${HOST}" create_nginx_site
run_cmd "Validate nginx config" nginx -t
run_cmd "Reload nginx" systemctl reload nginx
run_cmd "Request Let's Encrypt certificate for ${HOST}" run_certbot

cat <<EOF

Provisioning completed.

Next checks:
  - curl -I http://${HOST}
  - curl -I https://${HOST}
  - systemctl status nginx --no-pager
  - certbot certificates | grep ${HOST}

If you want to trigger this automatically after sales-counter submission, call this script from the backend after creating the new record.
EOF
