# Mengaktifkan portal di Cloudflare Pages

## 1. Akun uji dan pemetaan

Buat satu akun uji di Firebase Authentication → Users → Add user. Simpan password sendiri. Salin UID Firebase dari daftar Users. Temukan USER_ID pengguna yang sesuai pada sheet USERS aplikasi Project. Jangan menyalin PASSWORD_HASH.

Portal belum memberikan akses data HR/Finance; menu tersebut masih dalam persiapan. Identitas Firebase yang valid saja tidak cukup: UID harus masuk daftar anggota aktif.

## 2. Buat Pages terpisah

Cloudflare → Workers & Pages → Create application → Pages → Connect to Git (nama menu dapat berbeda).

- Repository: blueconnectin/mobile.blueconnect
- Production branch: main
- Framework preset: None
- Build command: kosong
- Build output directory: public
- Root directory: root repository

`public/_worker.js` menangani `/api/*`. `_routes.json` membatasi eksekusi Worker ke API; aset statis disajikan oleh Pages. Jangan mengunggah root repository sebagai output publik.

## 3. Daftar anggota server

Pada Settings → Variables and Secrets tambahkan variabel server `PORTAL_MEMBERS_JSON` untuk Production. Pilih Secret agar isi daftar tidak ditampilkan sebagai konfigurasi biasa. Contoh format (ganti UID, nama dan USER_ID):

```json
{
  "UID_FIREBASE_PENGGUNA": {
    "active": true,
    "name": "Nama pengguna",
    "project": { "enabled": true, "userId": "USR-ID-DARI-PROJECT" },
    "payment": { "enabled": false }
  }
}
```

Jangan simpan daftar pengguna nyata dalam repository. Kode tidak menggunakan email browser untuk memberi hak akses. `project.userId` baru merupakan pemetaan untuk integrasi berikutnya; belum membuat sesi SSO Project. Payment masih login terpisah bila tautannya diaktifkan.

Untuk menonaktifkan pengguna, ubah `active` menjadi false dan redeploy konfigurasi. Pemeriksaan berikutnya pada backend menggunakan daftar yang baru. Ini tidak mencabut sesi lama di Project/Payment. Untuk menonaktifkan autentikasi juga, gunakan Firebase Console. Verifikasi JWT lokal tidak memeriksa revocation Firebase pada setiap request; ID token yang sudah terbit dapat tetap valid hingga expiry. Membership server tetap diperiksa pada setiap request API.

Gunakan daftar akun uji terpisah untuk Preview; jangan salin daftar produksi otomatis.

## 4. Domain

Tambahkan mobile.blueconnect.id melalui Custom domains pada project Pages portal ini. Ikuti record DNS yang diberikan Cloudflare. Jangan mengubah domain Project atau Payment. Setelah variabel disimpan, redeploy agar binding tersedia.

Untuk pengujian melalui URL pages.dev, tambahkan hostname preview yang diperlukan ke Firebase Authorized domains. Domain produksi sudah dikonfigurasi pengguna.

## 5. Uji penerimaan

- Login benar dan salah, reset password, refresh, lalu logout.
- Akun Firebase yang belum terdaftar di PORTAL_MEMBERS_JSON tidak mendapat akses aplikasi.
- Akun active:false juga ditolak.
- Akun terdaftar mendapat menu sesuai konfigurasi.
- Tanpa binding, API memberi ACCESS_NOT_CONFIGURED dan UI menjelaskan layanan belum siap.
- Buka Project: untuk versi ini masih diminta login Project. SSO belum aktif.
- Uji desktop serta ponsel. Belum ada service worker/offline atau manifest install PWA.

## Batas validasi

Tes otomatis lokal mencakup tanda tangan RSA, issuer/audience, expiry, identitas, membership dan perilaku login dasar. Tes tidak membuktikan bahwa deployment Cloudflare atau konfigurasi akun Firebase nyata telah berfungsi. Uji penerimaan dengan akun uji diperlukan sebelum penggunaan.
