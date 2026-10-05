# SEO Pack — kreditmotorhonda.tech

Paket ini menyediakan `robots.txt`, `sitemap.xml`, dan 10 landing page di `public/`. Setiap halaman memiliki metadata title/description, canonical, Open Graph, JSON-LD, serta tautan internal ke halaman terkait dan simulator di `/#simulasi`.

## Cara penyajian

- Simpan halaman di `public/<slug>/index.html`; simpan `robots.txt` dan `sitemap.xml` langsung di `public/`.
- Dalam mode development, server Express menggunakan middleware Vite yang menyajikan file dari `public/`.
- Jalankan `npm run build` sebelum deploy. Vite menyalin isi `public/` ke `dist/`, lalu server Express production menyajikan `dist/` melalui `express.static`.
- Pastikan proses production berjalan dengan `NODE_ENV=production` agar server menggunakan file build, bukan middleware Vite.

## Data bisnis dan schema

- Tautan WhatsApp saat ini menggunakan nomor terkonfigurasi `6282129358899`. Jika nomor berubah, perbarui tautan di semua `public/<slug>/index.html` dan pengaturan situs.
- Nama bisnis, alamat, telepon, dan area layanan pada JSON-LD mengikuti data situs yang tersedia. Perbarui schema pada semua halaman terkait bila data bisnis berubah.
- Schema Product tidak memuat `offers`; tambahkan harga dan ketersediaan hanya jika datanya aktual dan konsisten dengan penawaran.
- Jangan menambahkan `sameAs` tanpa profil resmi yang terverifikasi atau rating/review yang tidak nyata.
