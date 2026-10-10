#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/var/www/wijaya.kreditmotorhonda.id"
REPO_URL="${1:-https://github.com/wijayaabadimulia1-cmd/wijaya-abadi.git}"
BRANCH="${2:-main}"
DOMAIN="kreditmotorhonda.tech"
SITE_URL="https://${DOMAIN}"
CERTBOT_EMAIL="${CERTBOT_EMAIL:-admin@kreditmotorhonda.tech}"

if [ ! -d "$APP_DIR" ]; then
  sudo mkdir -p "$APP_DIR"
  sudo chown -R "$USER:$USER" "$APP_DIR"
fi

cd "$APP_DIR"
if [ ! -d .git ]; then
  git clone --branch "$BRANCH" "$REPO_URL" .
fi

PERSISTENT_DIR="/var/lib/honda-wijaya-abadi"
DATA_DIR="$PERSISTENT_DIR/data"
UPLOADS_DIR="$PERSISTENT_DIR/uploads"
if [ ! -f "$DATA_DIR/db.json" ] || [ ! -d "$UPLOADS_DIR" ]; then
  if command -v pm2 >/dev/null 2>&1 && pm2 describe honda-wijaya-abadi >/dev/null 2>&1; then
    pm2 stop honda-wijaya-abadi
  fi
fi
sudo mkdir -p "$DATA_DIR" "$UPLOADS_DIR"
sudo chown -R "$USER:$USER" "$PERSISTENT_DIR"
if [ ! -f "$DATA_DIR/db.json" ] && [ -f "$APP_DIR/data/db.json" ]; then
  cp "$APP_DIR/data/db.json" "$DATA_DIR/db.json"
fi
if [ -d "$APP_DIR/public/uploads" ]; then
  cp -an "$APP_DIR/public/uploads/." "$UPLOADS_DIR/"
fi
if ! git diff --quiet -- data/db.json; then
  git checkout -- data/db.json
fi

git fetch origin "$BRANCH"
git checkout "$BRANCH"
git pull origin "$BRANCH"

if [ ! -f .env ]; then
  echo "Missing .env. Copy .env.example and configure production values before deploying." >&2
  exit 1
fi

sudo apt-get update
sudo apt-get install -y curl nginx certbot python3-certbot-nginx
if ! command -v node >/dev/null 2>&1 || [ "$(node -p 'process.versions.node.split(".")[0]')" -lt 22 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi

npm install
npm run build

if ! command -v pm2 >/dev/null 2>&1; then
  sudo npm install -g pm2
fi

if [ ! -f ecosystem.config.cjs ]; then
  echo "ecosystem.config.cjs not found" >&2
  exit 1
fi

mkdir -p logs
pm2 startOrReload ecosystem.config.cjs --update-env
pm2 save

sudo tee "/etc/nginx/sites-available/${DOMAIN}" > /dev/null <<EOF
server {
    listen 80;
  server_name ${DOMAIN};
  client_max_body_size 100m;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

sudo ln -sf "/etc/nginx/sites-available/${DOMAIN}" "/etc/nginx/sites-enabled/${DOMAIN}"
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx

if [ ! -d "/etc/letsencrypt/live/${DOMAIN}" ]; then
  sudo certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m "$CERTBOT_EMAIL"
fi

check_http_200() {
  local url="$1"
  local status

  status=$(curl --silent --show-error --location --max-time 30 --output /dev/null --write-out '%{http_code}' "$url") || {
    echo "Request failed: $url" >&2
    return 1
  }

  if [ "$status" != "200" ]; then
    echo "Expected HTTP 200, received HTTP $status: $url" >&2
    return 1
  fi

  echo "HTTP $status: $url"
}

check_http_200 "$SITE_URL/"
check_http_200 "$SITE_URL/sitemap.xml"

echo "Deployment complete. App is available at ${SITE_URL}"
