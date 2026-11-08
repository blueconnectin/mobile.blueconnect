/** Exact origin + window + nonce binding. ID tokens stay out of URLs/storage. */
export function launchProjectSso(user, status, win = window) {
  const target = 'https://project.blueconnect.id';
  const child = win.open(target + '/portal-login.html', '_blank');
  if (!child) { status('Browser memblokir tab Project. Izinkan pop-up untuk portal ini, lalu coba lagi.'); return; }
  let nonce = null, sent = false, ended = false;
  const cleanup = () => { ended = true; win.removeEventListener('message', receive); clearTimeout(timeout); };
  const timeout = setTimeout(() => { cleanup(); status('Project belum merespons. Tutup tab penghubung dan coba lagi.'); }, 120000);
  async function receive(event) {
    if (ended || event.origin !== target || event.source !== child) return;
    if (event.data?.type === 'BLUECONNECT_PROJECT_READY' && !sent && /^[a-f0-9]{64}$/.test(event.data.nonce)) {
      sent = true; nonce = event.data.nonce;
      try {
        const token = await user.getIdToken(true);
        if (ended || child.closed) return;
        child.postMessage({ type: 'BLUECONNECT_PORTAL_TOKEN', nonce, token }, target);
      } catch { cleanup(); status('Sesi login tidak tersedia. Silakan masuk kembali.'); }
    } else if (sent && event.data?.type === 'BLUECONNECT_PROJECT_RESULT' && event.data.nonce === nonce) {
      cleanup(); status(event.data.ok === true ? 'Project berhasil dibuka dengan akun Anda.' : 'Login Project belum berhasil. Hubungi administrator.');
    }
  }
  win.addEventListener('message', receive);
  status('Menghubungkan akun ke Project…');
  return cleanup;
}
