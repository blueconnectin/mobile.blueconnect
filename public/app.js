import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js';
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut, sendPasswordResetEmail, setPersistence, browserSessionPersistence } from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';

const app = initializeApp({apiKey:'AIzaSyAGyE8As4XjSDUI6Z-as__kZ4D6y88k2ag',authDomain:'blue-connect-mobile.firebaseapp.com',projectId:'blue-connect-mobile',appId:'1:325049467863:web:06434f6240e35ad786c192'});
const auth = getAuth(app);
const $ = id => document.getElementById(id);
const status = message => { $('status').textContent = message; };
let busy = false;
async function perform(action) {
  if (busy) return;
  busy = true;
  for (const button of document.querySelectorAll('button')) button.disabled = true;
  status('Memproses…');
  try { await action(); } catch(error) {
    status(error.code === 'auth/too-many-requests' ? 'Terlalu banyak percobaan. Coba lagi nanti.' : error.code === 'auth/network-request-failed' ? 'Koneksi terputus. Periksa internet Anda.' : 'Permintaan belum berhasil. Periksa data akun atau hubungi administrator.');
  } finally {
    busy = false;
    for (const button of document.querySelectorAll('button')) button.disabled = false;
  }
}
$('login-form').addEventListener('submit', event => {
  event.preventDefault();
  perform(async () => {
    await setPersistence(auth, browserSessionPersistence);
    await signInWithEmailAndPassword(auth, $('email').value.trim(), $('password').value);
    $('password').value = '';
    status('');
  });
});
$('reset').addEventListener('click', () => {
  if (!$('email').reportValidity()) return;
  perform(async () => {
    try { await sendPasswordResetEmail(auth, $('email').value.trim()); }
    catch(error) { if (error.code !== 'auth/user-not-found') throw error; }
    status('Jika email terdaftar, petunjuk reset password akan dikirim. Periksa juga folder spam.');
  });
});
$('logout').addEventListener('click', () => perform(async () => { await signOut(auth); status('Anda sudah keluar dari portal.'); }));
let accessGeneration = 0;
async function loadAccess(user) {
  const generation = ++accessGeneration;
  $('project-link').hidden = true;
  $('payment-link').hidden = true;
  $('access-status').textContent = user ? 'Memeriksa akses…' : '';
  if (!user) return;
  try {
    const token = await user.getIdToken();
    const response = await fetch('/api/me', {
      headers: { Authorization: 'Bearer ' + token },
      cache: 'no-store'
    });
    if (generation !== accessGeneration) return;
    if (!response.ok) {
      $('access-status').textContent = response.status === 403
        ? 'Akun belum mendapat akses atau sedang dinonaktifkan. Hubungi administrator.'
        : response.status === 401 ? 'Sesi tidak valid. Silakan keluar dan masuk kembali.'
        : 'Layanan akses belum siap. Hubungi administrator atau coba kembali.';
      return;
    }
    const data = await response.json();
    if (generation !== accessGeneration) return;
    $('project-link').hidden = data.apps?.project !== true;
    $('payment-link').hidden = data.apps?.payment !== true;
    $('access-status').textContent = data.apps?.project || data.apps?.payment
      ? 'Akses portal terverifikasi. Pilih aplikasi di bawah.'
      : 'Akun aktif. Akses aplikasi belum ditetapkan oleh administrator.';
  } catch {
    if (generation === accessGeneration) $('access-status').textContent = 'Pemeriksaan akses gagal. Periksa koneksi dan coba kembali.';
  }
}
$('retry-access').addEventListener('click', () => loadAccess(auth.currentUser));
onAuthStateChanged(auth, user => {
  $('login').hidden = Boolean(user);
  $('home').hidden = !user;
  $('identity').textContent = user?.email || '';
  loadAccess(user);
});

