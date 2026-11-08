# Verifikasi dan Terapkan akun Project

## Alur admin

1. Buat/simpan permintaan hubungan pada Manajemen Pengguna.
2. Klik **Verifikasi akun**. Portal membaca identitas akun melalui backend Project menggunakan identitas administrator Firebase yang diverifikasi server Mobile.
3. Periksa pegawai, username, USER_ID, nama, peran, dan status. Akun lama harus AKTIF dan perannya harus sama dengan usulan. Tidak ada perubahan role otomatis untuk akun lama.
4. Klik **Terapkan hubungan akun** dan konfirmasi. Verifikasi berlaku 5 menit, hanya untuk admin yang memeriksa dan revisi pengguna yang sama.
5. Daftar pengguna menampilkan ID Project; audit berisi APPLY_PROJECT_LINK. Permintaan selesai tidak lagi muncul sebagai menunggu verifikasi. Kembali ke portal → Periksa akses kembali untuk memperbarui menu.

Pembuatan profil baru menggunakan USER_ID deterministik dari UID Firebase serta kolom PORTAL_UID. Verifikasi tidak membuat profil; penerapan menggunakan script lock dan percobaan ulang tidak menambah baris kedua. Password lokal acak tidak ditampilkan; pengguna masuk melalui Mobile. Akun lama tidak diubah password, nama, role, atau riwayatnya.

## Penyimpanan dan konsistensi

Dua tabel tambahan (`account_link_verified`, `account_link_applied`) dibuat otomatis dengan CREATE TABLE IF NOT EXISTS ketika API admin dipakai. Tidak perlu menghapus atau mengubah tiga tabel awal. Permintaan existing tetap dapat diproses. Catatan hasil apply menjadi status final otoritatif; request awal dipertahankan untuk audit.

Update pemetaan pengguna, hasil apply dan audit dilakukan dalam satu transaksi D1 dengan pemeriksaan revisi, status request dan verifikasi. UID dan USER_ID Project unik pada hasil apply. Kepemilikan dalam PORTAL_MEMBERS_JSON juga diperiksa. Pemindahan akun yang sudah terhubung ke akun lain ditolak; tidak ada pemindahan kepemilikan diam-diam.

Apps Script dan D1 bukan satu transaksi bersama. Jika profil baru berhasil dibuat tetapi D1 gagal, profil dapat sementara belum terhubung. Retry memakai identitas deterministik yang sama dan tidak membuat profil ganda. Verifikasi ulang diperlukan bila data berubah atau masa verifikasi habis.

## Deployment

Canonical source berada di repository Mobile. Jalankan installer Project untuk menambahkan 22_PortalAccountService.js dan allowlist RPC verifyPortalAccountLink/applyPortalAccountLink, lalu deploy Apps Script serta Cloudflare Project. Scope external_request sudah diperlukan oleh SSO sebelumnya. Tidak ada secret atau binding baru; koneksi memakai bearer Firebase admin dan endpoint Mobile tetap.

PROJECT_APPS_SCRIPT_URL pada Worker Mobile opsional bila deployment Apps Script pindah; nilainya harus URL https://script.google.com/macros/s/.../exec. Default mengikuti deployment Project existing. Endpoint Apps Script tetap memeriksa admin lewat Mobile meskipun dipanggil langsung.

## Batas

Payment tetap menunggu pemeriksaan konektor. Profil Project baru mendapat role yang dipilih tetapi akses data/PO tetap mengikuti aturan Project existing. SSO/login global harus sudah dikonfigurasi agar profil terhubung dapat langsung dibuka dari portal. Logout global dan pencabutan sesi Project yang sudah terbit belum berubah.

Setelah hubungan diterapkan, perubahan hubungan/role bukan bagian dari form ini. Gunakan proses administratif terpisah; jangan menghapus hasil apply untuk memaksa pemindahan. Perubahan data Project antara verifikasi dan penerapan menyebabkan penerapan ditolak dan perlu verifikasi ulang.

Validasi: 44 tes Mobile/integrasi dan 99 tes Project existing lulus secara lokal. Pengujian browser produksi dengan akun pemilik tetap diperlukan. Tes tidak menggunakan data pegawai nyata.
