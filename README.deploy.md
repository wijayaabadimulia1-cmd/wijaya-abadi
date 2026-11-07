# Deployment ke Ubuntu 22.04 VPS

Dokumen ini berisi setup paling siap pakai untuk aplikasi full-stack ini di VPS Ubuntu 22.04.

## 1. Siapkan domain dan server

Pastikan semua domain mengarah ke IP VPS yang sama dan port TCP 80/443 dapat diakses sebelum meminta sertifikat HTTPS:

- `kreditmotorhonda.tech` dan `www.kreditmotorhonda.tech`
- `kreditmotorhonda.id` dan `www.kreditmotorhonda.id`
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

Generate `CATALOG_SERVICE_TOKEN` with `openssl rand -hex 32` and use the same value for all four processes. Do not commit `.env` or paste secrets into GitHub logs.

## 5. Install dependency dan build

```bash
npm install
npm run build
```

## 6. Persiapkan migrasi katalog bersama

Sebelum mengubah route Nginx atau me-reload PM2:

1. Buat backup `db.json` dan folder uploads dari semua situs lama.
2. Salin database situs utama ke `/var/lib/honda-wijaya-abadi/data/db.json`.
3. Salin database situs `wijaya` ke `/var/lib/honda-wijaya-abadi/sites/wijaya/data/db.json`.
4. Salin database `solusikreditmotor.cloud` ke `/var/lib/honda-wijaya-abadi/sites/solusi/data/db.json`.
5. Salin database `kreditmotorhonda.id` ke `/var/lib/honda-wijaya-abadi/sites/id/data/db.json`.
6. Salin semua folder uploads lama ke `/var/lib/honda-wijaya-abadi/uploads/` tanpa menimpa nama file yang sudah ada.

Jangan gunakan satu `db.json` untuk semua situs: file per situs tetap menyimpan tema, promo, identitas, prospek, dan analitik masing-masing. Semua proses memakai `OWNER_ANALYTICS_ROOT_DIR=/var/lib/honda-wijaya-abadi` agar Dashboard Owner dapat menemukan database lintas situs.

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

## 7. Jalankan empat situs dengan PM2

Pastikan `.env` memiliki satu secret internal yang sama untuk semua proses:

```bash
openssl rand -hex 32
```

Salin hasilnya ke `CATALOG_SERVICE_TOKEN` di `.env` (jangan masukkan ke Git). Setelah database per situs tersedia:

```bash
sudo mkdir -p /var/lib/honda-wijaya-abadi/data \
    /var/lib/honda-wijaya-abadi/uploads \
    /var/lib/honda-wijaya-abadi/sites/wijaya/data \
    /var/lib/honda-wijaya-abadi/sites/solusi/data \
    /var/lib/honda-wijaya-abadi/sites/id/data
sudo chown -R "$USER:$USER" /var/lib/honda-wijaya-abadi
test -s /var/lib/honda-wijaya-abadi/data/db.json
test -s /var/lib/honda-wijaya-abadi/sites/wijaya/data/db.json
test -s /var/lib/honda-wijaya-abadi/sites/solusi/data/db.json
test -s /var/lib/honda-wijaya-abadi/sites/id/data/db.json
pm2 startOrReload ecosystem.config.cjs --update-env
pm2 save
pm2 status
```

Proses `honda-wijaya-abadi` (3000) memiliki API katalog; `wijaya-kreditmotor` (3001), `solusi-kreditmotor` (3002), dan `kreditmotorhonda-id` (3003) mem-proxy operasi katalog ke port 3000. Tiap situs memiliki database admin dan pengaturan sendiri. Semua proses memakai satu `UPLOADS_DIR` dan root analytics bersama.

## 8. Konfigurasi Nginx

File [nginx.conf.example](nginx.conf.example) berisi keempat virtual host. Pasang tanpa menghapus konfigurasi situs lain:

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
    -d kreditmotorhonda.id -d www.kreditmotorhonda.id \
    -d wijaya.kreditmotorhonda.tech \
    -d solusikreditmotor.cloud -d www.solusikreditmotor.cloud \
    --non-interactive --agree-tos -m admin@kreditmotorhonda.tech
```

## 10. DNS

Arahkan semua nama host berikut ke IP VPS yang sama:

```text
kreditmotorhonda.tech
www.kreditmotorhonda.tech
kreditmotorhonda.id
www.kreditmotorhonda.id
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
    https://kreditmotorhonda.id/ \
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

## 12. Kata kunci Google di owner dashboard

Dashboard mengambil query, klik, impresi, CTR, dan posisi rata-rata dari Search Console. Agar datanya tersedia:

1. Aktifkan Google Search Console API di Google Cloud dan buat service account dengan kunci JSON.
2. Tambahkan email service account sebagai pengguna dengan akses baca ke properti domain `kreditmotorhonda.tech` dan `solusikreditmotor.cloud` di Search Console. Properti domain pertama mencakup subdomain Honda yang dipantau.
3. Di GitHub repo, buka **Settings → Secrets and variables → Actions**, lalu tambahkan repository secret bernama `GSC_SERVICE_ACCOUNT_JSON` dengan seluruh isi file JSON service account. Jangan kirim atau commit isi kunci tersebut.
4. Opsional, tambahkan repository variable `GSC_SITE_URLS` bila properti Search Console Anda berbeda dari default berikut:

```text
sc-domain:kreditmotorhonda.tech,sc-domain:solusikreditmotor.cloud
```

5. Jalankan ulang workflow **Deploy to Ubuntu VPS** agar secret dipasang aman di server, atau lakukan push berikutnya. Secret disimpan sebagai file server berizin terbatas dan tidak dikirim ke browser.

Search Console biasanya menunda data beberapa hari. Pilih rentang tanggal yang mencakup data final; dashboard menggabungkan query yang sama dari semua properti yang dikonfigurasi.
