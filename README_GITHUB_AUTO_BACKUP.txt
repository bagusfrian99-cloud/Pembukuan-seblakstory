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
