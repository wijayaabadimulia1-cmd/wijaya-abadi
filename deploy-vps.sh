#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/var/www/wijaya.kreditmotorhonda.id"
REPO_URL="${1:-https://github.com/wijayaabadimulia1-cmd/wijaya-abadi.git}"
BRANCH="${2:-main}"
MAIN_DOMAIN="kreditmotorhonda.tech"
CERTBOT_EMAIL="${CERTBOT_EMAIL:-admin@kreditmotorhonda.tech}"
EXPECTED_VPS_IP="${EXPECTED_VPS_IP:-103.253.213.232}"

for host in kreditmotorhonda.tech www.kreditmotorhonda.tech wijaya.kreditmotorhonda.tech solusikreditmotor.cloud www.solusikreditmotor.cloud; do
  resolved_ips=$(getent ahostsv4 "$host" | awk '{print $1}' | sort -u || true)
  if [ "$resolved_ips" != "$EXPECTED_VPS_IP" ]; then
    echo "DNS preflight failed for $host: expected only $EXPECTED_VPS_IP, resolved '${resolved_ips:-no IPv4 address}'. No deploy changes were made." >&2
    exit 1
  fi
done

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
sudo mkdir -p "$DATA_DIR" "$UPLOADS_DIR" \
  "$PERSISTENT_DIR/sites/wijaya/data" \
  "$PERSISTENT_DIR/sites/solusi/data"
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

if ! grep -Eq '^CATALOG_SERVICE_TOKEN=[[:space:]]*[A-Fa-f0-9]{64}$' .env; then
  echo "Set CATALOG_SERVICE_TOKEN in .env to a 64-character hex secret (openssl rand -hex 32)." >&2
  exit 1
fi

for site_db in \
  "$DATA_DIR/db.json" \
  "$PERSISTENT_DIR/sites/wijaya/data/db.json" \
  "$PERSISTENT_DIR/sites/solusi/data/db.json"; do
  if [ ! -s "$site_db" ]; then
    echo "Missing site database: $site_db. Back up and copy the existing site's db.json before deployment." >&2
    exit 1
  fi
done

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

sudo tee "/etc/nginx/sites-available/${MAIN_DOMAIN}" > /dev/null <<'EOF'
server {
    listen 80;
  server_name kreditmotorhonda.tech www.kreditmotorhonda.tech;
  client_max_body_size 100m;

  location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_cache_bypass $http_upgrade;
    }
}

server {
  listen 80;
  server_name wijaya.kreditmotorhonda.tech;
  client_max_body_size 100m;

    location / {
    proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_cache_bypass $http_upgrade;
  }
}

server {
  listen 80;
  server_name solusikreditmotor.cloud www.solusikreditmotor.cloud;
  client_max_body_size 100m;

  location / {
    proxy_pass http://127.0.0.1:3002;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_cache_bypass $http_upgrade;
    }
}
EOF

sudo ln -sf "/etc/nginx/sites-available/${MAIN_DOMAIN}" "/etc/nginx/sites-enabled/${MAIN_DOMAIN}"
sudo nginx -t
sudo systemctl reload nginx

sudo certbot --nginx --expand \
  -d kreditmotorhonda.tech -d www.kreditmotorhonda.tech \
  -d wijaya.kreditmotorhonda.tech \
  -d solusikreditmotor.cloud -d www.solusikreditmotor.cloud \
  --non-interactive --agree-tos -m "$CERTBOT_EMAIL"

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

check_http_200 "https://kreditmotorhonda.tech/"
check_http_200 "https://kreditmotorhonda.tech/sitemap.xml"
check_http_200 "https://wijaya.kreditmotorhonda.tech/"
check_http_200 "https://www.solusikreditmotor.cloud/"

echo "Deployment complete. Sites are available at:"
echo "- https://kreditmotorhonda.tech"
echo "- https://wijaya.kreditmotorhonda.tech"
echo "- https://www.solusikreditmotor.cloud"
