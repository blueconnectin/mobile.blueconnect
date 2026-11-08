# Manajemen Pengguna dan Hubungkan Akun

## Yang sudah tersedia

- Halaman `/admin.html`, hanya API administrator yang bisa membaca/menulis data.
- Membuat akun Firebase email/password dari UI admin dengan instance Auth sekunder berpersistensi memory; sesi admin tidak diganti. Password awal acak tidak ditampilkan/disimpan. Pengguna menerima permintaan reset untuk memilih password sendiri.
- Mendaftarkan akun Firebase existing berdasarkan UID.
- Mengaktifkan/menonaktifkan akses portal, dengan pemeriksaan revisi agar perubahan bersamaan tidak saling menimpa.
- Menyimpan/membatalkan pengaturan hubungan akun atau profil baru beserta usulan peran.
- Audit log pada setiap perubahan database, disimpan dalam transaksi yang sama.

## Batas fungsi penghubung

Semua pengaturan hubungan masih berstatus `pending_review`. Tidak ada endpoint approve/activate pada versi ini. Penyimpanan pengaturan tidak membuat profil di Project/Payment, tidak mengubah role pada aplikasi tujuan, dan tidak mengubah kepemilikan transaksi. Daftar akun lama, preview tagihan, dan eksekusi provisioning membutuhkan konektor tujuan. Payment belum diperiksa, sehingga perannya memakai REVIEW_REQUIRED dan riwayat tidak disentuh.

Akun Project yang sudah dipetakan melalui konfigurasi existing tetap berjalan. Pendaftaran UID existing ke database menyalin pemetaan Project dari konfigurasi awal untuk mempertahankan aksesnya. Pembuatan akun Firebase baru tidak otomatis memberi akses Project; permintaan profil baru perlu tahap implementasi provisioning berikutnya.

Penonaktifan di halaman admin memblokir API portal pada request berikutnya. Ini bukan penghapusan akun Firebase atau logout global: sesi Project/Payment yang sudah diterbitkan mengikuti mekanisme existing. Jangan menyebut akun tersebut telah dicabut dari seluruh aplikasi.

## Aktivasi satu kali oleh pemilik Cloudflare

1. Cloudflare → Storage & databases → D1 → Create database. Nama yang disarankan `blueconnect-portal-users`.
2. Buka Console database, jalankan SQL dari `migrations/0001_users.sql`. Jalankan seluruh statement; CREATE IF NOT EXISTS dapat diulang. Buat tabel sebelum memasang binding agar API existing tidak mencoba membaca tabel yang belum ada.
3. Project Pages **mobile-blueconnect** → Settings → Bindings → Add → D1 database. Variable name **PORTAL_DB**, pilih database tersebut untuk Production.
4. Settings → Variables and Secrets → Production: tambahkan **PORTAL_ADMIN_UIDS** sebagai Secret berisi array UID Firebase administrator, contoh `["UID_FIREBASE_ADMIN"]`. Gunakan UID akun yang sudah aktif di PORTAL_MEMBERS_JSON, bukan email/USER_ID Project. Tidak ada admin otomatis berdasarkan email, posisi pertama, atau role Project.
5. Pertahankan PORTAL_MEMBERS_JSON. Redeploy portal lalu Periksa akses kembali. Menu **Manajemen Pengguna** muncul hanya untuk UID yang ditetapkan administrator.
6. Buka `/admin.html`. Daftar database awal kosong; akun bootstrap dari secret tetap aktif. Untuk memasukkan akun admin ke daftar, pilih Daftarkan akun Firebase existing menggunakan UID yang sama. Nonaktifkan admin ditolak dari UI untuk menghindari kehilangan akses; perubahan pemilik tetap melalui konfigurasi Cloudflare.

Jangan commit UID pegawai atau isi daftar pengguna nyata ke GitHub. Gunakan database dan admin uji terpisah untuk Preview.

## Membuat pegawai

Pilih Buat akun baru, isi nama/email dan Simpan. Auth Firebase dibuat dari browser menggunakan instance sekunder; tidak ada service account di frontend. Backend tetap memerlukan admin untuk memberi membership. Firebase signup publik sendiri tidak memberi akses perusahaan.

Jika signup Firebase berhasil tetapi penyimpanan membership gagal/timeout, UI menampilkan UID dan mengganti mode ke existing. Periksa daftar sebelum mencoba ulang: akun mungkin sudah tercatat walaupun respons jaringan gagal. Jangan membuat akun email yang sama lagi. Jika undangan gagal, gunakan Lupa password di portal. Pendaftaran existing tidak memverifikasi email profil terhadap Firebase pada server; UID yang disalin admin adalah identitas akses yang menentukan.

## Penyimpanan

D1 menyimpan profil, status, permintaan hubungan dan audit. Sheets/Drive tetap dipakai aplikasi operasional existing. Pantau kapasitas, kuota dan backup D1; jangan menganggap kode GitHub sebagai backup isi database. Fitur kuota/retensi D1 mengikuti paket Cloudflare.

## Validasi

37 tes lokal lulus, termasuk SQL menggunakan SQLite, transaksi audit, akses admin, penolakan origin asing, konflik revisi, hubungan duplikat, dan pembatalan. Pengujian browser/Firebase account creation/D1 produksi belum dilakukan karena konfigurasi pemilik diperlukan. Tidak ada akun pegawai yang dibuat dalam pengujian otomatis.
