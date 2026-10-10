#!/usr/bin/env bash
set -Eeuo pipefail

APP_DIR="/var/www/wijaya-abadi"
APP_NAME="kreditmotorhonda"
BACKUP_DIR="/root/backup-kreditmotorhonda"
SITE_URL="https://kreditmotorhonda.tech"

echo "=========================================="
echo " DEPLOY KREDIT MOTOR HONDA"
echo "=========================================="

cd "$APP_DIR"

echo
echo "== Membuat backup data =="

mkdir -p "$BACKUP_DIR"

if [ -f "$APP_DIR/data/db.json" ]; then
    cp "$APP_DIR/data/db.json" "$BACKUP_DIR/db.json.backup"
    echo "Backup db.json: OK"
fi

if [ -d "$APP_DIR/public/uploads" ]; then
    rm -rf "$BACKUP_DIR/uploads"
    cp -a "$APP_DIR/public/uploads" "$BACKUP_DIR/uploads"
    echo "Backup uploads: OK"
fi

echo
echo "== Mengambil source terbaru dari Git =="

git fetch origin
git reset --hard origin/main

echo
echo "== Memulihkan data db.json =="

if [ -f "$BACKUP_DIR/db.json.backup" ]; then
    mkdir -p "$APP_DIR/data"
    cp "$BACKUP_DIR/db.json.backup" "$APP_DIR/data/db.json"
    echo "db.json berhasil dipulihkan."
fi

echo
echo "== Memulihkan folder uploads =="

if [ -d "$BACKUP_DIR/uploads" ]; then
    mkdir -p "$APP_DIR/public/uploads"
    cp -a "$BACKUP_DIR/uploads/." "$APP_DIR/public/uploads/"
    echo "uploads berhasil dipulihkan."
fi

echo
echo "== Memeriksa folder upload =="

mkdir -p "$APP_DIR/public/uploads"
APP_OWNER="$(stat -c '%U' "$APP_DIR")"
APP_GROUP="$(stat -c '%G' "$APP_DIR")"
chown "$APP_OWNER:$APP_GROUP" "$APP_DIR/public/uploads"
chmod 775 "$APP_DIR/public/uploads"
echo "Owner: $APP_OWNER:$APP_GROUP"

echo
echo "== Menginstal dependency =="

if [ -f package-lock.json ]; then
    npm ci
else
    npm install
fi

echo
echo "== Build aplikasi =="
npm run build

echo
echo "== Memeriksa PM2 =="

if ! pm2 describe "$APP_NAME" >/dev/null 2>&1; then
    echo "ERROR: PM2 '$APP_NAME' tidak ditemukan." >&2
    pm2 list
    exit 1
fi

echo
echo "== Restart PM2 =="
pm2 restart "$APP_NAME"
pm2 save

echo
echo "== Menunggu aplikasi siap =="

check_http_200() {
    local url="$1"
    local status

    if ! status="$(curl --silent --show-error --fail --retry 15 --retry-connrefused --retry-delay 2 --retry-max-time 90 --max-time 15 --output /dev/null --write-out '%{http_code}' "$url")"; then
        echo "ERROR: Health check failed: $url" >&2
        return 1
    fi

    if [ "$status" != "200" ]; then
        echo "ERROR: Expected HTTP 200, received HTTP $status: $url" >&2
        return 1
    fi

    echo "HTTP $status: $url"
}

check_http_200 "http://127.0.0.1:3000/"
check_http_200 "$SITE_URL/"
check_http_200 "$SITE_URL/sitemap.xml"

echo
echo "=========================================="
echo " DEPLOY SELESAI"
echo "=========================================="
echo "Website : $SITE_URL"
echo "App     : $APP_NAME"
echo "Folder  : $APP_DIR"