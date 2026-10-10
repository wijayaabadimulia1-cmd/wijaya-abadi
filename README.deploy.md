# Deployment ke Ubuntu 22.04 VPS

Dokumen ini berisi setup paling siap pakai untuk aplikasi full-stack ini di VPS Ubuntu 22.04.

## 1. Siapkan domain dan server

Pastikan A record `kreditmotorhonda.tech` mengarah ke IP VPS dan port TCP 80/443 dapat diakses dari internet sebelum meminta sertifikat HTTPS. Workflow otomatis menggunakan domain ini sebagai domain produksi.

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git nginx certbot python3-certbot-nginx ufw
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pm2
```

## 2. Buat aplikasi folder

```bash
sudo mkdir -p /var/www/wijaya.kreditmotorhonda.id
sudo chown -R $USER:$USER /var/www/wijaya.kreditmotorhonda.id
cd /var/www/wijaya.kreditmotorhonda.id
```

## 3. Clone repo

```bash
git clone https://github.com/wijayaabadimulia1-cmd/wijaya-abadi.git .
cp .env.example .env
```

## 4. Atur environment

Edit file `.env`:

```env
PORT=3000
APP_URL=https://kreditmotorhonda.tech
GEMINI_API_KEY=your_gemini_api_key_here
```

Set real production values in `.env` before starting or deploying. Do not commit `.env` or paste private keys/API keys into GitHub logs.

## 5. Install dependency dan build

```bash
npm install
npm run build
```

## 6. Jalankan dengan PM2

```bash
sudo mkdir -p /var/lib/honda-wijaya-abadi/data /var/lib/honda-wijaya-abadi/uploads
sudo chown -R "$USER:$USER" /var/lib/honda-wijaya-abadi
cp -n data/db.json /var/lib/honda-wijaya-abadi/data/db.json
cp -an public/uploads/. /var/lib/honda-wijaya-abadi/uploads/
pm2 start ecosystem.config.cjs
pm2 save
pm2 status
```

## 7. Konfigurasi Nginx

```bash
sudo tee /etc/nginx/sites-available/kreditmotorhonda.tech > /dev/null <<'EOF'
server {
    listen 80;
    server_name kreditmotorhonda.tech;
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

sudo ln -sf /etc/nginx/sites-available/kreditmotorhonda.tech /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

## 8. Aktifkan HTTPS dengan Let’s Encrypt

```bash
sudo certbot --nginx -d kreditmotorhonda.tech --non-interactive --agree-tos -m admin@kreditmotorhonda.tech
```

## 9. DNS

Atur A record:

```text
kreditmotorhonda.tech -> IP VPS Anda
```

## 10. Auto deploy via GitHub Actions

Tambahkan secrets berikut di GitHub repo:

- `VPS_HOST`
- `VPS_USER`
- `VPS_SSH_KEY`
- `VPS_KNOWN_HOSTS` (host key VPS, diperoleh dan diverifikasi sebelum disimpan)
- `CERTBOT_EMAIL` (opsional; default `admin@kreditmotorhonda.tech`)

Isi `VPS_KNOWN_HOSTS` dengan output `ssh-keyscan -H YOUR_VPS_IP` setelah fingerprint host diverifikasi melalui panel/provider VPS. Jangan menonaktifkan verifikasi host SSH.

Sebelum workflow pertama, siapkan checkout awal dan `.env` di VPS:

```bash
sudo mkdir -p /var/www/wijaya.kreditmotorhonda.id
sudo chown -R "$USER:$USER" /var/www/wijaya.kreditmotorhonda.id
git clone https://github.com/wijayaabadimulia1-cmd/wijaya-abadi.git /var/www/wijaya.kreditmotorhonda.id
cd /var/www/wijaya.kreditmotorhonda.id
cp .env.example .env
nano .env
```

Ganti nilai contoh dengan konfigurasi production. Repo harus dapat di-clone dan di-fetch oleh user VPS melalui HTTPS; untuk repo privat, siapkan kredensial/deploy key baca-saja GitHub pada VPS. Workflow tidak menaruh token GitHub di server.


Setelah itu, setiap push ke branch `main` akan otomatis deploy ke VPS.

## 11. Cek status aplikasi

```bash
pm2 logs honda-wijaya-abadi --lines 100
SITE_URL=https://kreditmotorhonda.tech
for url in "$SITE_URL/" "$SITE_URL/sitemap.xml"; do
    status=$(curl --silent --show-error --location --max-time 30 --output /dev/null --write-out '%{http_code}' "$url") || exit 1
    if [ "$status" != "200" ]; then
        echo "Expected HTTP 200, received HTTP $status: $url" >&2
        exit 1
    fi
    echo "HTTP $status: $url"
done
```

Kirim `https://kreditmotorhonda.tech/sitemap.xml` ke Google Search Console hanya setelah kedua URL di atas menampilkan HTTP 200.
