# Telegram Langsung - Seblak Story Pembukuan v3.3.30

## Alur
Telegram -> Telegram Bot -> PWA Pembukuan. Tidak memakai GitHub, Cloudflare Worker, atau D1 sebagai perantara.

PWA melakukan polling `getUpdates` saat aplikasi terbuka. Data yang cocok dengan format LAPORAN SHIFT KASIR langsung disimpan ke Buku Kas lokal. Shift + tanggal menjadi ID untuk mencegah duplikasi.

## Penting
- Token bot disimpan di localStorage perangkat dan tidak boleh dibagikan.
- Karena PWA langsung memanggil Bot API, aplikasi harus sedang dibuka agar pembacaan berjalan. Browser dapat menghentikan polling ketika aplikasi benar-benar ditutup atau dibatasi di latar belakang.
- Mode langsung menggunakan `getUpdates`, sehingga webhook Telegram lama perlu dilepas. Aplikasi akan menjalankan `deleteWebhook` saat sinkronisasi pertama tanpa menghapus pesan tertunda.
- Bot hanya menerima pesan yang memang dikirim/diteruskan ke bot atau chat tempat bot memiliki akses. Bot tidak dapat membaca percakapan pribadi dua pengguna yang tidak melibatkan bot.

## Pengaturan
Lainnya -> Input Otomatis Telegram
1. Masukkan Token Telegram Bot.
2. Chat ID opsional untuk membatasi sumber pesan.
3. Aktifkan input otomatis.
4. Tekan Sinkron Sekarang.

## Format
Tanggal, Shift, Kasir, Transaksi, Penjualan, Cash, Nontunai, Pengeluaran, dan Saldo.

Contoh:
```
📊 LAPORAN SHIFT KASIR
SEBLAK STORY
Tanggal: 22/09/2026
Waktu: 20.52
Kasir: Anna
Shift: SH-022
Transaksi: 25
Penjualan: Rp 650.000
Cash: Rp 500.000
Nontunai: Rp 150.000
Pengeluaran: Rp 0
Saldo: Rp 500.000
```
