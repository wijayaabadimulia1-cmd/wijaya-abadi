# VPS Deployment Commands (Ubuntu 22.04)

## 1. Buat SSH key di komputer lokal

```bash
ssh-keygen -t ed25519 -C "github-actions@wijaya-abadi" -f ~/.ssh/id_ed25519_wijaya_abadi
cat ~/.ssh/id_ed25519_wijaya_abadi.pub
```

## 2. Masukkan public key ke server

```bash
ssh root@YOUR_VPS_IP
mkdir -p ~/.ssh
chmod 700 ~/.ssh
nano ~/.ssh/authorized_keys
```

Paste hasil `id_ed25519_wijaya_abadi.pub` ke file authorized_keys.

## 3. Konfigurasi SSH client

```bash
mkdir -p ~/.ssh
cat > ~/.ssh/config <<'EOF'
Host wijaya-vps
    HostName YOUR_VPS_IP
    User root
    Port 22
    IdentityFile ~/.ssh/id_ed25519_wijaya_abadi
    IdentitiesOnly yes
    ServerAliveInterval 30
    ServerAliveCountMax 3
    StrictHostKeyChecking accept-new
    UserKnownHostsFile ~/.ssh/known_hosts
EOF
chmod 600 ~/.ssh/config
```

## 4. Test koneksi SSH

```bash
ssh wijaya-vps
```

## 5. Siapkan package dasar di VPS

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git nginx certbot python3-certbot-nginx ufw
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pm2
```

## 6. Buat folder aplikasi

```bash
sudo mkdir -p /var/www/wijaya.kreditmotorhonda.id
sudo chown -R $USER:$USER /var/www/wijaya.kreditmotorhonda.id
cd /var/www/wijaya.kreditmotorhonda.id
```

## 7. Clone repo

```bash
git clone https://github.com/wijayaabadimulia1-cmd/wijaya-abadi.git .
cp .env.example .env
```

## 8. Atur .env

```bash
nano .env
```

Isi:

```env
PORT=3000
APP_URL=https://kreditmotorhonda.tech
GEMINI_API_KEY=your_gemini_api_key_here
```

## 9. Install dependency dan build

```bash
npm install
npm run build
```

## 10. Jalankan aplikasi dengan PM2

```bash
sudo mkdir -p /var/lib/honda-wijaya-abadi/data /var/lib/honda-wijaya-abadi/uploads
sudo chown -R "$USER:$USER" /var/lib/honda-wijaya-abadi
cp -n data/db.json /var/lib/honda-wijaya-abadi/data/db.json
cp -an public/uploads/. /var/lib/honda-wijaya-abadi/uploads/
pm2 start ecosystem.config.cjs
pm2 save
pm2 status
```

## 11. Konfigurasi Nginx

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

## 12. HTTPS dengan Let’s Encrypt

```bash
sudo certbot --nginx -d kreditmotorhonda.tech --non-interactive --agree-tos -m admin@kreditmotorhonda.tech
```

## 13. Cek aplikasi

```bash
SITE_URL=https://kreditmotorhonda.tech
for url in "$SITE_URL/" "$SITE_URL/sitemap.xml"; do
    status=$(curl --silent --show-error --location --max-time 30 --output /dev/null --write-out '%{http_code}' "$url") || exit 1
    if [ "$status" != "200" ]; then
        echo "Expected HTTP 200, received HTTP $status: $url" >&2
        exit 1
    fi
    echo "HTTP $status: $url"
done
pm2 logs honda-wijaya-abadi --lines 100
```

Kirim `https://kreditmotorhonda.tech/sitemap.xml` ke Google Search Console hanya setelah kedua URL di atas menampilkan HTTP 200.

## 14. Auto Deploy dengan GitHub Actions

Tambahkan secrets di repo GitHub:

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

Contoh nilai:

```text
VPS_HOST=YOUR_VPS_IP
VPS_USER=root
VPS_SSH_KEY=-----BEGIN OPENSSH PRIVATE KEY-----
...
-----END OPENSSH PRIVATE KEY-----
```

Setelah itu, push ke branch `main` dan workflow akan otomatis menjalankan deploy.

Sebelum workflow pertama kali dijalankan, siapkan `.env` di `/var/www/wijaya.kreditmotorhonda.id` pada VPS. Workflow tidak membuat atau menimpa `.env`; deploy berhenti jika file tersebut belum tersedia. Database dan upload disimpan terpisah di `/var/lib/honda-wijaya-abadi` agar tidak tertimpa saat deploy. Pastikan DNS A record sudah aktif agar Certbot dapat menerbitkan sertifikat.
