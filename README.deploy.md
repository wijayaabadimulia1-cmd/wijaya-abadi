# Deployment ke Ubuntu 22.04 VPS

Dokumen ini berisi setup paling siap pakai untuk aplikasi full-stack ini di VPS Ubuntu 22.04.

## 1. Siapkan domain dan server

Pastikan semua domain mengarah ke IP VPS yang sama dan port TCP 80/443 dapat diakses sebelum meminta sertifikat HTTPS:

- `kreditmotorhonda.tech` dan `www.kreditmotorhonda.tech`
- `wijaya.kreditmotorhonda.tech`
- `solusikreditmotor.cloud` dan `www.solusikreditmotor.cloud`

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
CATALOG_SERVICE_TOKEN=output-dari-openssl-rand-hex-32
```

Generate `CATALOG_SERVICE_TOKEN` with `openssl rand -hex 32` and use the same value for all three processes. Do not commit `.env` or paste secrets into GitHub logs.

## 5. Install dependency dan build

```bash
npm install
npm run build
```

## 6. Persiapkan migrasi katalog bersama

Sebelum mengubah route Nginx atau me-reload PM2:

1. Buat backup `db.json` dan folder uploads dari ketiga situs lama.
2. Salin database situs utama ke `/var/lib/honda-wijaya-abadi/data/db.json`.
3. Salin database situs `wijaya` ke `/var/lib/honda-wijaya-abadi/sites/wijaya/data/db.json`.
4. Salin database `solusikreditmotor.cloud` ke `/var/lib/honda-wijaya-abadi/sites/solusi/data/db.json`.
5. Salin semua folder uploads lama ke `/var/lib/honda-wijaya-abadi/uploads/` tanpa menimpa nama file yang sudah ada.

Jangan gunakan satu `db.json` untuk ketiga situs: file per situs tetap menyimpan tema, promo, identitas, prospek, dan analitik masing-masing.

Setelah checkout terbaru tersedia di VPS, tetapi sebelum mengganti proses PM2 lama, tinjau hasil dry-run:

```bash
cd /var/www/wijaya.kreditmotorhonda.id
DATA_DIR=/var/lib/honda-wijaya-abadi/data \
UPLOADS_DIR=/var/lib/honda-wijaya-abadi/uploads \
node scripts/migrate-shared-catalog.mjs
```

Dry-run membaca API publik ketiga domain dan tidak menulis file. Pastikan jumlah motor unik dan model FIF sudah benar. Setelah backup terverifikasi, jalankan migrasi satu kali dengan `--apply`:

```bash
DATA_DIR=/var/lib/honda-wijaya-abadi/data \
UPLOADS_DIR=/var/lib/honda-wijaya-abadi/uploads \
node scripts/migrate-shared-catalog.mjs --apply
```

Migrasi membuat backup database owner, menggabungkan motor berdasarkan nama yang dinormalisasi, menggabungkan model FIF, dan menyalin foto katalog ke folder uploads bersama. Jangan hapus backup DB atau uploads lama sampai foto dan katalog di semua domain terverifikasi.

## 7. Jalankan tiga situs dengan PM2

Pastikan `.env` memiliki satu secret internal yang sama untuk semua proses:

```bash
openssl rand -hex 32
```

Salin hasilnya ke `CATALOG_SERVICE_TOKEN` di `.env` (jangan masukkan ke Git). Setelah database per situs tersedia:

```bash
sudo mkdir -p /var/lib/honda-wijaya-abadi/data \
    /var/lib/honda-wijaya-abadi/uploads \
    /var/lib/honda-wijaya-abadi/sites/wijaya/data \
    /var/lib/honda-wijaya-abadi/sites/solusi/data
sudo chown -R "$USER:$USER" /var/lib/honda-wijaya-abadi
test -s /var/lib/honda-wijaya-abadi/data/db.json
test -s /var/lib/honda-wijaya-abadi/sites/wijaya/data/db.json
test -s /var/lib/honda-wijaya-abadi/sites/solusi/data/db.json
pm2 startOrReload ecosystem.config.cjs --update-env
pm2 save
pm2 status
```

Proses `honda-wijaya-abadi` (3000) memiliki katalog; `wijaya-kreditmotor` (3001) dan `solusi-kreditmotor` (3002) mem-proxy operasi katalog ke port 3000. Ketiganya memakai satu `UPLOADS_DIR`.

## 8. Konfigurasi Nginx

File [nginx.conf.example](nginx.conf.example) berisi ketiga virtual host. Pasang tanpa menghapus konfigurasi situs lain:

```bash
sudo cp nginx.conf.example /etc/nginx/sites-available/wijaya-sites
sudo ln -sf /etc/nginx/sites-available/wijaya-sites /etc/nginx/sites-enabled/wijaya-sites
sudo nginx -t
sudo systemctl reload nginx
```

Nonaktifkan hanya konfigurasi lama yang memiliki `server_name` sama setelah memastikan file tersebut memang untuk domain ini.

## 9. Aktifkan HTTPS dengan Let’s Encrypt

```bash
sudo certbot --nginx --expand \
    -d kreditmotorhonda.tech -d www.kreditmotorhonda.tech \
    -d wijaya.kreditmotorhonda.tech \
    -d solusikreditmotor.cloud -d www.solusikreditmotor.cloud \
    --non-interactive --agree-tos -m admin@kreditmotorhonda.tech
```

## 10. DNS

Arahkan semua nama host berikut ke IP VPS yang sama:

```text
kreditmotorhonda.tech
www.kreditmotorhonda.tech
wijaya.kreditmotorhonda.tech
solusikreditmotor.cloud
www.solusikreditmotor.cloud
```

## 11. Auto deploy via GitHub Actions

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

## 12. Cek status aplikasi

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
for url in \
    https://wijaya.kreditmotorhonda.tech/ \
    https://www.solusikreditmotor.cloud/; do
        status=$(curl --silent --show-error --location --max-time 30 --output /dev/null --write-out '%{http_code}' "$url") || exit 1
        if [ "$status" != "200" ]; then
                echo "Expected HTTP 200, received HTTP $status: $url" >&2
                exit 1
        fi
        echo "HTTP $status: $url"
done
```

Kirim `https://kreditmotorhonda.tech/sitemap.xml` ke Google Search Console hanya setelah kedua URL di atas menampilkan HTTP 200.
