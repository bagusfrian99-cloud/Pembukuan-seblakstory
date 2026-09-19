# Input Otomatis Telegram - Seblak Story Pembukuan v3.3.17

## Alur
Telegram Bot -> Cloudflare Worker -> GitHub `telegram/inbox.json` -> Seblak Story Pembukuan.

Aplikasi membaca inbox saat dibuka jika opsi otomatis aktif. Laporan shift yang sama tidak dibuat dua kali karena `Shift + Tanggal` menjadi kunci transaksi.

## 1. Buat Telegram Bot
Di Telegram buka `@BotFather`, gunakan `/newbot`, lalu simpan token bot secara rahasia.

## 2. Deploy Worker
Buat Cloudflare Worker baru dan masukkan isi `telegram-worker.js`.

Buat Worker Secrets/Variables:
- `TELEGRAM_BOT_TOKEN` = token bot (untuk referensi/keamanan; webhook URL tetap dikendalikan Telegram)
- `TELEGRAM_WEBHOOK_SECRET` = string acak, misalnya `seblak-telegram-2026`
- `GITHUB_TOKEN` = Fine-grained PAT dengan akses repository tujuan dan `Contents: Read and write`
- `GITHUB_OWNER` = owner repository, contoh `bagusfrian99-cloud`
- `GITHUB_REPO` = repository, contoh `Pembukuan-seblakstory`
- `GITHUB_BRANCH` = `main`
- `GITHUB_PATH` = `telegram/inbox.json`

## 3. Pasang webhook Telegram
Setelah Worker memiliki URL HTTPS, panggil Telegram Bot API `setWebhook` dengan URL Worker dan secret token yang sama dengan `TELEGRAM_WEBHOOK_SECRET`.

Contoh menggunakan browser/curl (ganti TOKEN dan URL):
`https://api.telegram.org/botTOKEN/setWebhook?url=https://WORKER_URL/&secret_token=SEBLak_SECRET`

Jangan masukkan token bot ke source code GitHub Pages.

## 4. Setting aplikasi
Di Seblak Story Pembukuan:
Lainnya -> Input Otomatis Telegram

Gunakan:
- Folder Inbox GitHub: `telegram`
- Nama file Inbox: `inbox.json`
- Aktifkan input otomatis saat aplikasi dibuka

Pengaturan GitHub di aplikasi tetap harus berisi Owner, Repository, Branch dan Fine-grained PAT yang dapat membaca `telegram/inbox.json`.

## 5. Format laporan yang didukung
Contoh:
LAPORAN SHIFT KASIR
SEBLAK STORY
Tanggal: 18/09/2026
Waktu: 20.52
Kasir: Anna
Shift: SH-018
Transaksi: 25
Penjualan: Rp 563.000
Cash: Rp 471.000
Nontunai: Rp 92.000
Pengeluaran: Rp 0
Saldo: Rp 471.000

Yang dimasukkan ke Buku Kas:
- Pemasukan Tunai = Cash
- Pemasukan Non Tunai = Nontunai
- Pengeluaran = Pengeluaran
- Penjualan dan Saldo tidak dibuat sebagai transaksi tambahan agar tidak terjadi hitung ganda.
