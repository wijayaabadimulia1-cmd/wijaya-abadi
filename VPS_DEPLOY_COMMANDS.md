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
    StrictHostKeyChecking accept
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
sudo apt install -y nodejs npm
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
NODE_ENV=production
PORT=3000
APP_URL=https://wijaya.kreditmotorhonda.id
GEMINI_API_KEY=your_gemini_api_key_here
```

## 9. Install dependency dan build

```bash
npm install
npm run build
```

## 10. Jalankan aplikasi dengan PM2

```bash
pm2 start ecosystem.config.cjs
pm2 save
pm2 status
```

## 11. Konfigurasi Nginx

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

## 12. HTTPS dengan Let’s Encrypt

```bash
sudo certbot --nginx -d wijaya.kreditmotorhonda.id --non-interactive --agree-tos -m admin@wijaya.kreditmotorhonda.id
```

## 13. Cek aplikasi

```bash
curl -I http://localhost:3000
curl -I https://wijaya.kreditmotorhonda.id
pm2 logs honda-wijaya-abadi --lines 100
```

## 14. Auto Deploy dengan GitHub Actions

Tambahkan secrets di repo GitHub:

- `VPS_HOST`
- `VPS_USER`
- `VPS_SSH_KEY`

Contoh nilai:

```text
VPS_HOST=YOUR_VPS_IP
VPS_USER=root
VPS_SSH_KEY=-----BEGIN OPENSSH PRIVATE KEY-----
...
-----END OPENSSH PRIVATE KEY-----
```

Setelah itu, push ke branch `main` dan workflow akan otomatis menjalankan deploy.
