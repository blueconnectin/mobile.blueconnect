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

SSO Project/Payment belum aktif. Tautan masih membuka aplikasi existing dengan login masing-masing. Logout portal belum mengakhiri sesi aplikasi lainnya. HRIS, Finance, PWA install/offline belum diimplementasikan. Tidak ada data perusahaan dalam frontend ini.

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

Source awal disalin dari branch codex/mobile-login-foundation di Starlite-Documentation-Apps. Seluruh perubahan portal selanjutnya disimpan di repository ini. Belum ada deployment yang dikonfirmasi.
