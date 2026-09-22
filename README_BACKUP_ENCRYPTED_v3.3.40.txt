Seblak Story Pembukuan v3.3.40 – Backup Terenkripsi

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
