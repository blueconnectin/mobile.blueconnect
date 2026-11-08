/* Runs only on project.blueconnect.id. Tokens never enter the URL. */
(function () {
  'use strict';
  const portalOrigin = 'https://mobile.blueconnect.id';
  const status = message => { document.getElementById('status').textContent = message; };
  if (location.origin !== 'https://project.blueconnect.id' || !window.opener) {
    status('Buka Project melalui tombol Proyek di portal Mobile.'); return;
  }
  const parent = window.opener;
  const nonce = Array.from(crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2, '0')).join('');
  let received = false;
  const timeout = setTimeout(() => {
    window.removeEventListener('message', receive);
    status('Waktu menghubungkan akun habis. Kembali ke portal dan coba lagi.');
  }, 60000);
  async function receive(event) {
    if (received || event.origin !== portalOrigin || event.source !== parent ||
        event.data?.type !== 'BLUECONNECT_PORTAL_TOKEN' || event.data.nonce !== nonce ||
        typeof event.data.token !== 'string' || event.data.token.length > 16000) return;
    received = true; clearTimeout(timeout); window.removeEventListener('message', receive);
    try {
      const response = await fetch('/api/rpc', {
        method: 'POST', credentials: 'same-origin', cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ protocol: 1, method: 'loginWithPortal', args: [event.data.token], sessionToken: '' }),
        signal: AbortSignal.timeout(90000)
      });
      const result = await response.json();
      if (!response.ok || !result.ok || !result.result?.success || typeof result.result.token !== 'string' || !result.result.token) throw new Error('LOGIN_FAILED');
      localStorage.setItem('STARLITE_SESSION_TOKEN', result.result.token);
      // Do not include the resulting Project session token in postMessage responses.
      parent.postMessage({ type: 'BLUECONNECT_PROJECT_RESULT', nonce: nonce, ok: true }, portalOrigin);
      window.opener = null;
      location.replace('/');
    } catch {
      parent.postMessage({ type: 'BLUECONNECT_PROJECT_RESULT', nonce: nonce, ok: false }, portalOrigin);
      status('Akun belum berhasil dihubungkan. Kembali ke portal dan hubungi administrator jika masalah berulang.');
    }
  }
  window.addEventListener('message', receive);
  parent.postMessage({ type: 'BLUECONNECT_PROJECT_READY', nonce: nonce }, portalOrigin);
})();
