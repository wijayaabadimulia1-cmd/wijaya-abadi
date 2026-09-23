# Deployment ke Ubuntu 22.04 VPS

Dokumen ini berisi setup paling siap pakai untuk aplikasi full-stack ini di VPS Ubuntu 22.04.

## 1. Siapkan server

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git nginx certbot python3-certbot-nginx ufw
sudo apt install -y nodejs npm
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
git clone https://github.com/<your-user>/<your-repo>.git .
cp .env.example .env
```

## 4. Atur environment

Edit file `.env`:

```env
NODE_ENV=production
PORT=3000
APP_URL=https://wijaya.kreditmotorhonda.id
GEMINI_API_KEY=your_gemini_api_key_here
```

## 5. Install dependency dan build

```bash
npm install
npm run build
```

## 6. Jalankan dengan PM2

```bash
pm2 start ecosystem.config.cjs
pm2 save
pm2 status
```

## 7. Konfigurasi Nginx

```bash
sudo tee /etc/nginx/sites-available/wijaya.kreditmotorhonda.id > /dev/null <<'EOF'
server {
    listen 80;
    server_name wijaya.kreditmotorhonda.id;

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
```

## 8. Aktifkan HTTPS dengan Let’s Encrypt

```bash
sudo certbot --nginx -d wijaya.kreditmotorhonda.id --non-interactive --agree-tos -m admin@wijaya.kreditmotorhonda.id
```

## 9. DNS

Atur A record:

```text
wijaya.kreditmotorhonda.id -> IP VPS Anda
```

## 10. Auto deploy via GitHub Actions

Tambahkan secrets berikut di GitHub repo:

- `VPS_HOST`
- `VPS_USER`
- `VPS_SSH_KEY`

Setelah itu, setiap push ke branch `main` akan otomatis deploy ke VPS.

## 11. Cek status aplikasi

```bash
pm2 logs honda-wijaya-abadi --lines 100
curl -I http://localhost:3000
curl -I https://wijaya.kreditmotorhonda.id
```
