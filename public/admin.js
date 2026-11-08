import {initializeApp,deleteApp} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js';
import {getAuth,onAuthStateChanged,createUserWithEmailAndPassword,setPersistence,inMemoryPersistence,signOut,sendPasswordResetEmail} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';
const config={apiKey:'AIzaSyAGyE8As4XjSDUI6Z-as__kZ4D6y88k2ag',authDomain:'blue-connect-mobile.firebaseapp.com',projectId:'blue-connect-mobile',appId:'1:325049467863:web:06434f6240e35ad786c192'};
const auth=getAuth(initializeApp(config));
const $=id=>document.getElementById(id);
const message=text=>{$('message').textContent=text;};
const errors={PROJECT_RESPONSE_NOT_JSON:'Backend Project mengirim halaman web, bukan respons API. Periksa deployment Apps Script dan akses web app.',PROJECT_GOOGLE_AUTH_REQUIRED:'Apps Script Project memerlukan otorisasi Google. Jalankan authorizePortalConnection_ sebagai pemilik deployment dan setujui izinnya.',PROJECT_ADMIN_AUTH_FAILED:'Backend Project belum berhasil memvalidasi akun admin melalui Mobile. Periksa izin koneksi Apps Script dan akses akun admin.',PROJECT_USER_NOT_FOUND:'ID akun Project tidak ditemukan. Periksa USER_ID pada sheet USERS.',PROJECT_ACCOUNT_ROLE_OR_STATUS_CHANGED:'Peran atau status akun Project tidak sesuai. Pastikan akun AKTIF dan perannya sama dengan usulan.',PROJECT_BACKEND_OUTDATED:'Deployment backend Project belum menyediakan fungsi verifikasi. Periksa deployment Apps Script terbaru.',PROJECT_UPSTREAM_REJECTED:'Server Project menolak permintaan. Periksa akses deployment Apps Script.',VERIFICATION_REQUIRED:'Klik Verifikasi lagi; hasil verifikasi berlaku 5 menit dan hanya untuk admin yang memeriksa.',PROJECT_ROLE_MISMATCH:'Peran akun Project berbeda dari usulan. Batalkan dan buat permintaan dengan peran akun yang benar.',PROJECT_ACCOUNT_CHANGED:'Identitas akun berubah setelah diperiksa. Verifikasi ulang.',PROJECT_VERIFICATION_FAILED:'Project belum dapat memverifikasi akun. Pastikan ID, peran, status aktif, dan deployment backend benar.',PROJECT_CONNECTION_FAILED:'Koneksi Project gagal. Coba Verifikasi kembali.',EXISTING_LINK_REASSIGNMENT_BLOCKED:'Pegawai sudah memiliki hubungan akun lain. Pemindahan hubungan perlu penanganan khusus.',PAYMENT_CONNECTOR_NOT_READY:'Konektor Payment belum diaktifkan.',ADMIN_REQUIRED:'Akun Anda tidak memiliki akses administrator.',DATABASE_NOT_CONFIGURED:'Penyimpanan pengaturan belum diaktifkan. Ikuti panduan aktivasi administrator.',ACCESS_DENIED:'Akses akun dinonaktifkan.',USER_ALREADY_EXISTS:'Pengguna sudah terdaftar.',REQUEST_ALREADY_PENDING:'Sudah ada pengaturan koneksi yang menunggu verifikasi.',ACCOUNT_ALREADY_LINKED:'Akun lama telah dihubungkan ke pengguna lain.',CONFLICT_REFRESH_REQUIRED:'Data berubah. Muat ulang sebelum menyimpan.',ADMIN_DEACTIVATION_REQUIRES_CONFIGURATION:'Akun administrator dilindungi. Ubah penetapan admin melalui konfigurasi pemilik.'};
let generation=0,busy=false;
async function api(path,body){
 if(!auth.currentUser)throw Error('Silakan login melalui portal.');
 const token=await auth.currentUser.getIdToken();
 const response=await fetch('/api/admin/'+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),cache:'no-store'});
 let data;try{data=await response.json();}catch{
 const status=Number.isInteger(response.status)?response.status:0;
 const ray=response.headers?.get('cf-ray')||'';
 const reference=/^[a-f0-9]{16,32}(?:-[A-Z]{3})?$/i.test(ray)?' · Referensi '+ray:'';
 throw Error('Respons server tidak dapat dibaca [HTTP '+status+reference+']. Muat ulang halaman dan coba kembali. Jika tetap gagal, kirim tangkapan layar pesan ini.');
 }
 if(!data || typeof data!=='object' || Array.isArray(data))throw Error('Format respons API tidak sesuai [HTTP '+response.status+'].');
 if(!response.ok){const code=typeof data.error==='string' && /^[A-Z_]{1,80}$/.test(data.error)?data.error:'';throw Error((errors[code]||'Permintaan gagal. Periksa data dan coba lagi.')+(code?' ['+code+']':''));}return data;
}
function node(tag,text){const el=document.createElement(tag);el.textContent=text;return el;}
async function load(){
 const current=++generation;
 const [data,log]=await Promise.all([api('users'),api('audit')]);if(current!==generation)return;
 $('admin-content').hidden=false;$('users').replaceChildren();$('link-uid').replaceChildren();$('requests').replaceChildren();$('audit').replaceChildren();
 for(const user of data.users){
  const box=node('article','');box.append(node('h3',user.name),node('p',(user.email||user.uid)+' · '+(user.active?'Aktif':'Nonaktif')),node('p',user.project_user_id?'Project: '+user.project_user_id:'Project belum terhubung'));
  const button=node('button',user.active?'Nonaktifkan':'Aktifkan');button.className='secondary';button.addEventListener('click',()=>action(async()=>{if(!confirm('Ubah status akses portal untuk '+user.name+'? Sesi Project/Payment yang sudah berjalan belum otomatis dicabut.'))return;await api('user-status',{uid:user.uid,active:!user.active,revision:user.revision});await load();message('Status pengguna disimpan.');}));box.append(button);$('users').append(box);
  const option=node('option',user.name+' — '+(user.email||user.uid));option.value=user.uid;$('link-uid').append(option);
 }
 if(!data.users.length)$('users').append(node('p','Belum ada pengguna yang didaftarkan melalui pengaturan ini. Akun konfigurasi awal tetap dipertahankan.'));
 for(const item of data.requests){const box=node('article','');box.append(node('p',item.application+' · '+item.uid+' · '+(item.mode==='link'?'Hubungkan '+item.legacy_id:'Profil baru')+' · '+item.requested_role+' · Menunggu verifikasi'));if(item.application==='project'){
 const verify=node('button','Verifikasi akun');verify.className='secondary';
 const preview=node('div','');preview.setAttribute('role','status');preview.setAttribute('aria-live','polite');
 verify.addEventListener('click',()=>action(async()=>{
  const data=await api('verify-project-link',{id:item.id});preview.replaceChildren();
  if(data.status==='applied'){await load();message('Hubungan akun sudah diterapkan.');return;}
  const profile=data.profile;
  preview.append(node('p','Pegawai: '+data.employee.name),node('p','Akun Project: '+profile.username+' · '+profile.userId),node('p','Nama: '+profile.name+' · Peran: '+profile.role+' · Status: '+profile.status));
  if(item.mode==='new')preview.append(node('p','Profil baru akan dibuat saat diterapkan.'));
  const apply=node('button','Terapkan hubungan akun');const applyFeedback=node('p','');applyFeedback.setAttribute('role','status');
  apply.addEventListener('click',()=>action(async()=>{
   if(!confirm('Hubungkan '+data.employee.name+' ke '+profile.username+' ('+profile.role+')? Riwayat akun tujuan akan dapat diakses sesuai peran.')){applyFeedback.textContent='Penerapan dibatalkan.';return;}
   await api('apply-project-link',{id:item.id,confirmed:true});await load();message('Hubungan akun Project berhasil diterapkan. Kembali ke portal dan klik Periksa akses kembali.');
  },applyFeedback));preview.append(apply,applyFeedback);message('Periksa identitas akun sebelum menerapkan. Verifikasi berlaku 5 menit.');
 },preview));box.append(verify,preview);
 }
 const cancel=node('button','Batalkan pengaturan');cancel.className='secondary';cancel.addEventListener('click',()=>action(async()=>{await api('cancel-request',{id:item.id});await load();message('Pengaturan dibatalkan. Anda dapat membuat pengaturan pengganti.');}));box.append(cancel);$('requests').append(box);}
 for(const item of log.events)$('audit').append(node('p',item.created_at+' · '+item.action+' · '+item.target_uid));
}
async function action(fn,feedback){if(busy)return;busy=true;if(feedback)feedback.textContent='Memproses permintaan Project…';document.querySelectorAll('button').forEach(b=>b.disabled=true);try{await fn();}catch(e){const text=e.message||'Permintaan gagal.';message(text);if(feedback)feedback.textContent=text;}finally{busy=false;document.querySelectorAll('button').forEach(b=>b.disabled=false);}}
$('refresh').addEventListener('click',()=>action(load));
$('create-mode').addEventListener('change',()=>{$('uid-field').hidden=$('create-mode').value==='new';$('user-uid').required=$('create-mode').value==='existing';});
$('new-project').addEventListener('change',()=>{$('new-role-field').hidden=!$('new-project').checked;});
$('user-form').addEventListener('submit',event=>{event.preventDefault();action(async()=>{
 // Verify administrator and database readiness before creating an Auth identity.
 await api('users');
 const projectRequested=$('new-project').checked,projectRole=$('new-project-role').value;
 const email=$('user-email').value.trim(),name=$('user-name').value.trim();let uid=$('user-uid').value.trim(),created=false;
 if($('create-mode').value==='new'){
  const secondary=initializeApp(config,'provision-'+crypto.randomUUID());const secondaryAuth=getAuth(secondary);
  try{await setPersistence(secondaryAuth,inMemoryPersistence);const password=Array.from(crypto.getRandomValues(new Uint8Array(32)),x=>x.toString(16).padStart(2,'0')).join('');const result=await createUserWithEmailAndPassword(secondaryAuth,email,password);uid=result.user.uid;created=true;await signOut(secondaryAuth);}finally{await deleteApp(secondary);}
 }
 try{await api('users',{uid,email,name,active:true});}catch(error){if(created){$('create-mode').value='existing';$('uid-field').hidden=false;$('user-uid').value=uid;message('Akun Firebase sudah dibuat, tetapi penyimpanan akses belum terkonfirmasi. UID: '+uid+'. Muat ulang daftar sebelum mencoba mendaftarkan akun existing.');return;}throw error;}
 let projectReady=false,projectError='';
 if(projectRequested){
  try{
   message('Akun Mobile tersimpan. Menyiapkan akses Project…');
   const request=await api('link-requests',{uid,application:'project',mode:'new',role:projectRole,confirmed:true});
   await api('verify-project-link',{id:request.id});
   await api('apply-project-link',{id:request.id,confirmed:true});
   projectReady=true;
  }catch(error){projectError=error.message||'Koneksi Project gagal.';}
 }
 let sent=false;if(created){try{await sendPasswordResetEmail(auth,email);sent=true;}catch{}}
 $('user-form').reset();$('uid-field').hidden=true;$('new-role-field').hidden=true;await load();message((created?(sent?'Akun dibuat. Email pengaturan password telah diminta; periksa inbox/spam pengguna.':'Akun dibuat, tetapi email pengaturan password gagal dikirim. Gunakan Lupa password di portal.'):'Pengguna existing berhasil didaftarkan.')+(projectReady?' Akses Project aktif dengan profil baru.':projectRequested?' Akun Mobile tersimpan, tetapi akses Project belum selesai: '+projectError+' Lanjutkan permintaan di bagian Hubungkan akun; jangan buat akun Mobile ulang.':''));
 });});
function roles(){const payment=$('application').value==='payment';$('role').replaceChildren();for(const role of payment?['REVIEW_REQUIRED']:['UPLOADER','OPERATOR','SUPERVISOR','PLANNING','PROJEK','ADMIN']){const option=node('option',payment?'Ditentukan setelah pemeriksaan Payment':role);option.value=role;$('role').append(option);}}
$('application').addEventListener('change',roles);roles();
$('link-mode').addEventListener('change',()=>{const linked=$('link-mode').value==='link';$('legacy-field').hidden=!linked;$('legacy-id').required=linked;});
$('link-form').addEventListener('submit',event=>{event.preventDefault();action(async()=>{await api('link-requests',{uid:$('link-uid').value,application:$('application').value,mode:$('link-mode').value,legacyId:$('legacy-id').value,role:$('role').value,confirmed:$('confirmed').checked});await load();message('Pengaturan tersimpan sebagai menunggu verifikasi. Belum ada perubahan pada akun atau transaksi aplikasi tujuan.');});});
onAuthStateChanged(auth,user=>{generation++;$('admin-content').hidden=true;if(!user){message('Silakan login melalui portal terlebih dahulu.');return;}action(async()=>{await load();message('Kelola pengguna dan pengaturan koneksi aplikasi.');});});
