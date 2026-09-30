<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/bd629d44-3672-4e6f-ad5a-0adb33037246

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

# wijaya-abadi

## Foto katalog motor

Admin panel dan katalog tidak membatasi jumlah motor; banyaknya motor yang dapat disimpan tetap bergantung pada kapasitas penyimpanan server. Setiap motor mendukung hingga 80 foto. Foto pertama menjadi cover kartu katalog, sedangkan foto lainnya dapat dilihat melalui galeri. Panel admin menyediakan 10 gaya animasi foto dan pengaturan jeda pergantian 3-15 detik. Struktur data dan contoh foto tersedia di `schemas/katalog-motor.schema.json` dan `examples/katalog-motor.json`.
