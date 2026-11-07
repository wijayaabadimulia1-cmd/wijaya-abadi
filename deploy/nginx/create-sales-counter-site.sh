#!/usr/bin/env bash
set -euo pipefail

ROOT_DOMAIN="${1:-kreditmotorhonda.id}"
SUBDOMAIN="${2:-rudi}"
PORT="${3:-3003}"
HOST="${SUBDOMAIN}.${ROOT_DOMAIN}"
SITE_AVAILABLE="/etc/nginx/sites-available/${HOST}"
SITE_ENABLED="/etc/nginx/sites-enabled/${HOST}"

if [[ -z "${SUBDOMAIN}" || "${SUBDOMAIN}" == "@" ]]; then
  echo "Usage: sudo bash create-sales-counter-site.sh <root-domain> <subdomain> [port]"
  echo "Example: sudo bash create-sales-counter-site.sh kreditmotorhonda.id rudi 3003"
  exit 1
fi

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
nginx -t
systemctl reload nginx

echo "Config nginx dibuat untuk ${HOST}"
echo "Jalankan: sudo certbot --nginx -d ${HOST}"
