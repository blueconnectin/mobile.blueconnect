# Blueconnect Mobile

Repository utama portal perusahaan: https://github.com/blueconnectin/mobile.blueconnect.
Target domain: mobile.blueconnect.id. Frontend Cloudflare Pages dan Firebase Authentication project blue-connect-mobile.

## Fitur yang sudah dibuat

- Login email/password, reset password, logout portal, dan sesi browser.
- API `/api/me` memverifikasi tanda tangan RS256 ID token Firebase, issuer, audience, expiry dan identitas.
- Daftar anggota aktif melalui binding server `PORTAL_MEMBERS_JSON`; menu aplikasi mengikuti izin server.
- Pemetaan UID Firebase ke USER_ID Project disiapkan dalam konfigurasi anggota.
- Pemeriksaan otomatis melalui GitHub Actions.

## Status integrasi

Kode SSO Project tersedia, tetapi default nonaktif hingga adapter Project dipasang dan konfigurasi diaktifkan. Payment masih memakai login terpisah. Logout portal belum mengakhiri sesi aplikasi lainnya. HRIS, Finance, PWA install/offline belum diimplementasikan. Tidak ada data perusahaan dalam frontend ini.

Pemeriksaan akses ini melindungi API portal, bukan endpoint Project/Payment; keduanya tetap memiliki pemeriksaan sesi sendiri. Integrasi berikutnya harus memverifikasi pertukaran identitas pada backend Apps Script juga, karena endpoint Apps Script dapat diakses langsung.

## Struktur

- `public/`: frontend dan Worker Pages.
- `tests/`: pengujian Node tanpa instalasi dependency.
- `docs/cloudflare-setup.md`: langkah deployment dan konfigurasi akun.

## Validasi

Node 22 atau lebih baru:

```sh
npm run check
npm test
```

## Hosting

Cloudflare Pages: repository ini, branch main, framework None, build command kosong, output `public`. Atur binding anggota terlebih dahulu mengikuti [panduan deployment](docs/cloudflare-setup.md).

Konfigurasi web Firebase bukan private key. Jangan commit password, daftar pegawai, service account atau token Cloudflare. Akun Firebase dibuat administrator; tidak ada UI pendaftaran mandiri. Keamanan data tetap bergantung pada membership backend, bukan ketiadaan tombol daftar.

Source awal disalin dari branch codex/mobile-login-foundation di Starlite-Documentation-Apps. Seluruh perubahan portal selanjutnya disimpan di repository ini. Deployment otomatis portal telah dikonfirmasi pengguna pada commit uji b497929. SSO belum diverifikasi pada akun nyata.

## SSO Project

Lihat [panduan aktivasi](docs/project-sso.md). Adapter dan installer berada di `integrations/project/` dan `scripts/install-project-sso.mjs`. Seluruh source integrasi disimpan di repository Mobile; salinan adapter harus dipasang di repository Project agar mengikuti pipeline deployment yang sudah ada.

## Pengaturan pengguna

Menu Manajemen Pengguna dan Hubungkan Akun tersedia setelah binding D1 dan UID administrator dikonfigurasi. Ikuti [panduan aktivasi](docs/user-management.md). Hubungan Project mendukung Verifikasi dan Terapkan untuk akun lama maupun profil baru. Payment tetap menunggu verifikasi konektor. Penonaktifan portal belum mencabut sesi aplikasi lain.

Panduan [Verifikasi dan Terapkan Project](docs/project-account-links.md).
