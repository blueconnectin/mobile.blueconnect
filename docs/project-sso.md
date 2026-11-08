# SSO Mobile → Project

## Status dan batas

Source integrasi berada di repository Mobile. Adapter harus dipasang di Project karena Project memiliki frontend/API/deployment sendiri. Payment tidak diubah. SSO default nonaktif agar pemasangan bertahap tidak memutus login lama.

Alur: pengguna menekan Proyek pada domain produksi Mobile → tab penghubung di domain Project mengirim nonce → portal memeriksa origin dan window kemudian mengirim Firebase ID token lewat postMessage ke origin Project yang tepat → Apps Script Project memanggil endpoint HTTPS tetap `/api/project/identity` pada Mobile → Worker memverifikasi JWT dan membership → Project membaca USERS, memeriksa status AKTIF, dan membuat sesi dengan role dari sheet Project.

Firebase token tidak ditulis ke URL atau penyimpanan Project. Sesi Project disimpan di localStorage memakai mekanisme aplikasi existing. Project bisa diakses lewat sesi tersebut setelah reload. Token Firebase adalah bearer credential: jangan mencatat request body/Authorization pada log. Endpoint Mobile tidak menerima UID/role/userId dari klien untuk menentukan akun. Tidak ada shared secret tambahan.

SSO ini menyatukan login, belum logout global. Keluar/menonaktifkan akun di Mobile tidak otomatis mematikan sesi Project yang sudah dibuat. Masa sesi mengikuti aplikasi Project existing. Login username/password lama tetap tersedia selama transisi. Portal hanya mengaktifkan handoff pada https://mobile.blueconnect.id, bukan preview/pages.dev. Browser harus mengizinkan tab/pop-up dan relasi opener (jangan memakai header COOP same-origin pada halaman ini tanpa menyesuaikan alur).

## Pemasangan Project

Pada checkout repository Project, jalankan dari checkout Mobile:

```sh
node scripts/install-project-sso.mjs /absolute/path/to/Starlite-Documentation-Apps
```

Installer memperbarui allowlist RPC, menambahkan handler Apps Script, scope external_request, halaman penghubung, dan membangun ulang output Cloudflare Project. Installer tidak push atau deploy. Jalankan di checkout terpisah; review diff dan tes Project sebelum commit. Jika struktur upstream berubah, installer menolak pola yang tidak dikenal.

## Aktivasi berurutan

1. Pasang/deploy adapter backend dan frontend Project. Pipeline Apps Script membutuhkan scope baru `https://www.googleapis.com/auth/script.external_request`. Jika deployment otomatis gagal karena otorisasi, jangan aktifkan tombol SSO dulu.
2. Buka editor Apps Script **Project**, pilih fungsi `authorizePortalConnection_`, lalu Run. Akun deployer menyetujui izin koneksi eksternal saat diminta. Fungsi hanya menguji endpoint tanpa kredensial dan tidak membuat sesi/data. Status reachable true / HTTP 401 berarti endpoint terlindungi dapat dijangkau.
3. Pada Apps Script Project → Project Settings → Script Properties tambahkan `PORTAL_SSO_ENABLED` bernilai `true` (teks). Pastikan versi deployment sudah memuat adapter; jika hanya mengedit lewat editor, buat versi deployment baru.
4. Pada Pages **Mobile** → Variables and Secrets, Production tambahkan `PROJECT_SSO_ENABLED` = `true` (Text). Pertahankan PORTAL_MEMBERS_JSON existing, dengan project.enabled true dan project.userId yang benar. Redeploy Mobile.
5. Login di https://mobile.blueconnect.id, klik Periksa akses kembali, lalu Proyek. Tab Project seharusnya terbuka sebagai akun yang dipetakan, tanpa password Project.

Jangan aktifkan PROJECT_SSO_ENABLED sebelum halaman `/portal-login.html` dan RPC backend terdeploy. Tidak perlu mengubah secret pemetaan yang sudah berhasil. USER_ID bukan username atau UID Firebase.

## Verifikasi dan rollback

- Uji akun yang dipetakan, nonaktif, tidak dipetakan, dan salah peran.
- Setelah sukses, periksa nama/peran Project serta akses data/PO yang sesuai.
- Refresh Project, logout Project, dan ulangi dari Mobile.
- Uji ponsel dan desktop. Popup yang diblokir harus menampilkan petunjuk, bukan mengirim token lewat URL.
- Jika gagal, ubah PROJECT_SSO_ENABLED menjadi false lalu redeploy Mobile; tombol kembali menjadi tautan login lama. PORTAL_SSO_ENABLED dapat dinonaktifkan di Apps Script.

Tes lokal: 30 pengujian Mobile/SSO dan 99 pengujian existing Project lulus pada versi adapter awal. Ini bukan bukti deployment/otorisasi Google atau uji browser produksi. Tahap tersebut masih memerlukan akun uji dan akses pemilik.
