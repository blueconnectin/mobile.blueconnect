# Password pengguna

Akun baru: admin mengisi password awal (8–128 karakter) pada formulir Tambah pengguna. Password dikirim ke Firebase Authentication; tidak disimpan di D1, localStorage, atau riwayat portal. Kebijakan password Firebase juga tetap berlaku. Pembuatan akun tidak mengirim email reset.

Akun existing: tombol Atur password menggunakan endpoint admin yang memverifikasi token Firebase, daftar admin, Origin, konfirmasi, dan UID pengguna terdaftar. Akun dan hubungan Project tetap menggunakan UID yang sama.

## Aktivasi satu kali untuk perubahan password akun existing

1. Di Google Cloud project blue-connect-mobile, buat service account khusus pengelolaan Firebase Authentication. Beri role Firebase Authentication Admin (roles/firebaseauth.admin), bukan Owner.
2. Buat key JSON untuk service account tersebut.
3. Cloudflare Pages mobile-blueconnect → Settings → Variables and secrets → Production: tambahkan Secret bernama FIREBASE_SERVICE_ACCOUNT_JSON, dengan isi lengkap file JSON. Jangan commit file tersebut atau mengirimkannya melalui chat.
4. Redeploy produksi agar binding tersedia.
5. Di menu pengguna, isi Password baru dan klik Atur password. Berikan password kepada pegawai melalui jalur pribadi.

Key hanya digunakan server untuk memperoleh OAuth access token dari Google dan mengubah password UID tujuan. Password lama tidak dapat ditampilkan. Penggantian password Firebase tidak otomatis mencabut sesi aplikasi Project yang sudah diterbitkan.
