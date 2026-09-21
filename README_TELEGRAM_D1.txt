SEBLAK STORY PEMBUKUAN v3.3.22
Koneksi Telegram langsung ke Cloudflare Worker + D1

1. Deploy telegram-worker.js ke Worker:
   seblak-story-telegram
2. Pastikan binding D1:
   DB -> seblak-story-db
3. Pastikan Secrets:
   TELEGRAM_BOT_TOKEN
   TELEGRAM_WEBHOOK_SECRET
   APP_API_KEY
4. Webhook Telegram tetap:
   https://seblak-story-telegram.s3bl4kstory.workers.dev/telegram/webhook
5. Buka aplikasi -> Lainnya -> Input Otomatis Telegram.
6. Isi:
   URL Worker: https://seblak-story-telegram.s3bl4kstory.workers.dev
   APP API Key: nilai secret APP_API_KEY yang dibuat di Cloudflare.
7. Simpan Pengaturan -> Sinkron Sekarang.

Catatan keamanan:
APP_API_KEY disimpan di perangkat/browser aplikasi agar PWA statis dapat membaca D1.
Jangan masukkan token bot Telegram ke aplikasi.
