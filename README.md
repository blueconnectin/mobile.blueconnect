# Blueconnect Mobile — fondasi login

Frontend statis untuk Cloudflare Pages. Repository utama: https://github.com/blueconnectin/mobile.blueconnect. Folder ini terpisah dari Project dan Payment. Tidak mengandung data perusahaan atau akses backend.

## Status

- Login email/password, reset password, logout portal memakai Firebase Authentication.
- Sesi browser menggunakan session persistence.
- Menu Project dan Payment masih berupa tautan. SSO belum diimplementasikan.
- HRIS dan Finance belum diimplementasikan; tidak menampilkan data contoh seolah-olah data nyata.
- Autentikasi tidak memberikan otorisasi data perusahaan. Backend wajib memverifikasi token dan memeriksa membership/hak akses pada setiap operasi.
- Tidak ada pendaftaran mandiri pada UI. Buat akun uji melalui Firebase Console. Tidak adanya tombol daftar bukan kontrol keamanan: akses data tetap harus berbasis daftar anggota yang disetujui server.

## Deployment terpisah

Buat project Cloudflare Pages khusus portal, output folder ini, tanpa build command. Hubungkan mobile.blueconnect.id hanya ke project portal. Jangan mengganti output/deployment Project. Firebase Email/Password dan authorized domains sudah dikonfigurasi oleh pemilik.

## Pengujian sebelum penggunaan

Gunakan akun uji Firebase: login benar/salah, reset password, refresh, logout, dan tampilan mobile. Pengujian akun nyata belum dilakukan. Logout portal saat ini tidak mengakhiri sesi aplikasi Project/Payment.

## Integrasi Project berikutnya

1. Buat pemetaan yang disetujui admin: Firebase UID ke USER_ID Project. Jangan memetakan otomatis hanya dari nama atau email yang dikirim browser.
2. Verifikasi JWT Firebase pada server: tanda tangan Google, issuer, audience blue-connect-mobile, expiry; periksa anggota aktif dan hak akses.
3. Pertukaran sesi lintas domain memakai kode sekali pakai, berumur pendek, terikat tujuan/state. Jangan menaruh ID token/refresh token dalam URL.
4. Backend Apps Script harus memverifikasi permintaan integrasi; Worker saja tidak cukup karena endpoint Apps Script bisa diakses langsung.
5. Uji token palsu/kedaluwarsa, akun tidak terpetakan/nonaktif, replay kode, role, logout dan pencabutan akses sebelum deployment.
6. Migrasikan pengguna lama dengan aktivasi akun; pertahankan USER_ID dan riwayat. Jangan memindahkan password SHA-256 lama.

Jangan mengaktifkan SSO dengan cara mempercayai UID/email dari frontend atau menghapus requireSession_ dari Apps Script.

## Struktur repository

- `public/`: frontend untuk Cloudflare Pages.
- `tests/`: pengujian logika login, jalankan `node --test tests/*.test.cjs`.
- Cloudflare Pages: framework None, build command kosong, build output directory `public`.
- Salinan awal berasal dari branch `codex/mobile-login-foundation` repository Starlite-Documentation-Apps. Pengembangan portal selanjutnya dilakukan di repository ini.
