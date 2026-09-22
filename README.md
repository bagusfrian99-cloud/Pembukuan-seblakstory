# Seblak Story Pembukuan

Dokumentasi, pengaturan, backup GitHub terenkripsi, Telegram, dan catatan update aplikasi.

SEBLAK STORY PEMBUKUAN v3.3.11
Backup Otomatis ke GitHub

CARA SETUP
1. Upload semua file ke repository GitHub Pages.
2. Buka aplikasi > Lainnya > Backup ke GitHub.
3. Isi:
   - GitHub Owner / Username
   - Nama Repository
   - Branch (umumnya main)
   - Folder Backup (default: backup)
   - Fine-grained Personal Access Token
4. Centang "Aktifkan backup otomatis setelah data berubah".
5. Tekan "Simpan Pengaturan".
6. Tekan "Backup Sekarang" untuk uji pertama.

TOKEN GITHUB
Gunakan Fine-grained Personal Access Token yang dibatasi ke repository yang diperlukan.
Permission yang dibutuhkan: Contents = Read and write.
Jangan menaruh token langsung di source code.

HASIL BACKUP
File dibuat/diubah otomatis di:
backup/backup-YYYY-MM-DD.json

Perubahan data akan memicu backup otomatis dengan jeda singkat agar tidak mengirim banyak upload berturut-turut.
Saat aplikasi dibuka, jika backup otomatis sudah aktif dan konfigurasi lengkap, aplikasi juga mencoba melakukan backup.

CATATAN KEAMANAN
Pada versi GitHub Pages murni, token berada di penyimpanan browser perangkat. Ini praktis tetapi bukan model keamanan paling kuat. Untuk keamanan lebih tinggi, gunakan OAuth/GitHub App dengan backend/serverless sebagai perantara.
SEBLAK STORY PEMBUKUAN v3.3.8

Update utama:
- UI web/PWA dirombak mengikuti mockup Seblak Story Pembukuan: Beranda, Buku Kas, Stok Bahan, Laporan, dan Lainnya.
- Navigasi bawah mobile seperti mockup.
- Buku Kas dipisah Pemasukan, Pengeluaran, dan Riwayat.
- Pemasukan manual tetap memakai pilihan Tunai / Non Tunai dan masuk ke laporan.
- Stok bahan ditampilkan model kartu dengan status Aman/Hampir Habis/Habis.
- Pembelian stok tetap menambah stok dan otomatis mencatat pengeluaran.
- Laporan menampilkan total, saldo/laba, grafik, export CSV, dan cetak 80 mm.
- Backup/restore JSON dan sinkron POS tetap tersedia di Lainnya.
- Riwayat sinkronisasi hanya menampilkan riwayat terakhir.
- Service worker/cache dinaikkan ke v3.3.8 agar update GitHub Pages lebih mudah diterapkan.

Untuk GitHub Pages: ekstrak isi ZIP ke repository, pastikan index.html berada di root repository, lalu aktifkan Settings > Pages > Deploy from branch.

Telegram automatic input bridge is included in v3.3.17. See README_TELEGRAM_AUTO.md.
Seblak Story Pembukuan v3.3.41 – Backup Terenkripsi

FITUR
- Backup seluruh localStorage aplikasi, termasuk transaksi, stok, pengaturan dan parameter.
- Token GitHub dan Token Telegram ikut dicadangkan tetapi berada di dalam ciphertext terenkripsi.
- Enkripsi AES-256-GCM.
- Kunci data dibungkus dengan password menggunakan PBKDF2-SHA256 250.000 iterasi + AES-KW.
- Password backup tidak pernah dimasukkan ke file backup.
- Backup manual menghasilkan file JSON terenkripsi.
- Backup GitHub otomatis menggunakan file JSON terenkripsi.
- Restore meminta password lalu memulihkan seluruh localStorage dan kunci enkripsi.

PENTING
- Password backup wajib disimpan sendiri. Tanpa password, backup tidak dapat dipulihkan.
- Token tidak dikirim ke server selain sebagai bagian dari ciphertext backup.
- Backup otomatis ke GitHub hanya berjalan jika aplikasi memiliki akses ke GitHub dan enkripsi sudah diaktifkan pada perangkat.
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
v3.3.41 - Update Telegram

Menambahkan tombol "Update Telegram" pada modal Telegram -> Pembukuan. Tombol menjalankan pengecekan ulang Telegram untuk mengambil/merefresh laporan terbaru tanpa menerapkan data ke Buku Kas. Data tetap harus diperiksa lalu ditekan Terapkan ke Pembukuan.
v3.3.42 - Dashboard Telegram

Menghapus menu cepat Buku Kas, Stok Bahan, Laporan, dan Lainnya dari area yang dilingkari pada dashboard. Tombol Cek Telegram dipindahkan ke area tersebut sebagai penggantinya. Navigasi utama bawah tetap dipertahankan. Cache PWA dinaikkan ke v3.3.42.
v3.3.43 - Tombol Beli pada Daftar Barang yang Harus Dibeli

Menambahkan tombol Beli pada setiap barang di Daftar Barang yang Harus Dibeli. Tombol berada di sebelah kanan jumlah pack dan membuka form Beli Barang untuk barang tersebut. Cache PWA dinaikkan ke v3.3.43.v3.3.44 - Daftar Barang yang Harus Dibeli menjadi menu/filter Stok

Perubahan:
- Daftar Barang yang Harus Dibeli dipindahkan dari kolom terpisah menjadi menu/filter tersendiri.
- Posisi menu "Harus Dibeli" berada di sebelah kiri "Semua".
- Saat memilih "Harus Dibeli", hanya daftar barang yang perlu dibeli ditampilkan.
- Tombol Beli pada setiap barang tetap tersedia.
- Tombol Kirim via WA tetap tersedia di menu Harus Dibeli.
- Menu Semua, Sisa Sedikit, dan Kurang tetap berfungsi.
- Cache PWA dinaikkan ke v3.3.44.
