#!/usr/bin/env bash
set -euo pipefail

# ==========================================================
# FINAL DEPLOY BLOCK FOR UBUNTU 22.04 + NODE + PM2 + NGINX
# DOMAIN: wijaya.kreditmotorhonda.id
# ==========================================================

export DEBIAN_FRONTEND=noninteractive
APP_DIR="/var/www/wijaya.kreditmotorhonda.id"
REPO_URL="https://github.com/wijayaabadimulia1-cmd/wijaya-abadi.git"
DOMAIN="wijaya.kreditmotorhonda.id"
PORT=3000

echo "==> Updating system"
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git nginx certbot python3-certbot-nginx ufw
sudo apt install -y nodejs npm
sudo npm install -g pm2

echo "==> Preparing app directory"
sudo mkdir -p "$APP_DIR"
sudo chown -R "$USER:$USER" "$APP_DIR"

if [ ! -d "$APP_DIR/.git" ]; then
  cd "$APP_DIR"
  git clone "$REPO_URL" .
else
  cd "$APP_DIR"
  git fetch origin main
  git checkout main
  git pull origin main
fi

if [ ! -f "$APP_DIR/.env" ]; then
  cp "$APP_DIR/.env.example" "$APP_DIR/.env"
fi

cat > "$APP_DIR/.env" <<EOF
NODE_ENV=production
PORT=3000
APP_URL=https://wijaya.kreditmotorhonda.id
GEMINI_API_KEY=your_gemini_api_key_here
EOF

cd "$APP_DIR"
npm install
npm run build

if [ ! -f "$APP_DIR/ecosystem.config.cjs" ]; then
  echo "ecosystem.config.cjs not found" >&2
  exit 1
fi

pm2 reload "$APP_DIR/ecosystem.config.cjs" --update-env || pm2 start "$APP_DIR/ecosystem.config.cjs"
pm2 save

sudo tee /etc/nginx/sites-available/$DOMAIN > /dev/null <<EOF
server {
    listen 80;
    server_name $DOMAIN;

    location / {
        proxy_pass http://127.0.0.1:$PORT;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

sudo ln -sf /etc/nginx/sites-available/$DOMAIN /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx

if [ ! -d /etc/letsencrypt/live/$DOMAIN ]; then
  sudo certbot --nginx -d $DOMAIN --non-interactive --agree-tos -m admin@wijaya.kreditmotorhonda.id
fi

pm2 status
curl -I http://localhost:$PORT || true
curl -I https://$DOMAIN || true

echo "========================================"
echo "Deployment complete."
echo "Website: https://$DOMAIN"
echo "PM2 app: honda-wijaya-abadi"
echo "========================================"
