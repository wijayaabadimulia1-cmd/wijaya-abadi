#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/var/www/wijaya.kreditmotorhonda.id"
REPO_URL="${1:-https://github.com/<your-user>/<your-repo>.git}"
BRANCH="${2:-main}"
SITE_URL="https://kreditmotorhonda.tech"

if [ ! -d "$APP_DIR" ]; then
  sudo mkdir -p "$APP_DIR"
  sudo chown -R "$USER:$USER" "$APP_DIR"
fi

cd "$APP_DIR"
if [ ! -d .git ]; then
  git clone --branch "$BRANCH" "$REPO_URL" .
fi

git fetch origin "$BRANCH"
git checkout "$BRANCH"
git pull origin "$BRANCH"

npm install --production=false
npm run build

if ! command -v pm2 >/dev/null 2>&1; then
  npm install -g pm2
fi

if [ ! -f ecosystem.config.cjs ]; then
  echo "ecosystem.config.cjs not found" >&2
  exit 1
fi

pm2 reload ecosystem.config.cjs --update-env || pm2 start ecosystem.config.cjs

sudo apt-get update
sudo apt-get install -y curl nginx certbot python3-certbot-nginx || true

sudo tee /etc/nginx/sites-available/wijaya.kreditmotorhonda.id > /dev/null <<'EOF'
server {
    listen 80;
    server_name wijaya.kreditmotorhonda.id;
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

sudo ln -sf /etc/nginx/sites-available/wijaya.kreditmotorhonda.id /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx

if [ ! -d /etc/letsencrypt/live/wijaya.kreditmotorhonda.id ]; then
  sudo certbot --nginx -d wijaya.kreditmotorhonda.id --non-interactive --agree-tos -m admin@wijaya.kreditmotorhonda.id
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

echo "Deployment complete. App should be available at https://wijaya.kreditmotorhonda.id"
