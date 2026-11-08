import {initializeApp,deleteApp} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js';
import {getAuth,onAuthStateChanged,createUserWithEmailAndPassword,setPersistence,inMemoryPersistence,signOut,sendPasswordResetEmail} from 'https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js';
const config={apiKey:'AIzaSyAGyE8As4XjSDUI6Z-as__kZ4D6y88k2ag',authDomain:'blue-connect-mobile.firebaseapp.com',projectId:'blue-connect-mobile',appId:'1:325049467863:web:06434f6240e35ad786c192'};
const auth=getAuth(initializeApp(config));
const $=id=>document.getElementById(id);
const message=text=>{$('message').textContent=text;};
const errors={ADMIN_REQUIRED:'Akun Anda tidak memiliki akses administrator.',DATABASE_NOT_CONFIGURED:'Penyimpanan pengaturan belum diaktifkan. Ikuti panduan aktivasi administrator.',ACCESS_DENIED:'Akses akun dinonaktifkan.',USER_ALREADY_EXISTS:'Pengguna sudah terdaftar.',REQUEST_ALREADY_PENDING:'Sudah ada pengaturan koneksi yang menunggu verifikasi.',ACCOUNT_ALREADY_LINKED:'Akun lama telah dihubungkan ke pengguna lain.',CONFLICT_REFRESH_REQUIRED:'Data berubah. Muat ulang sebelum menyimpan.',ADMIN_DEACTIVATION_REQUIRES_CONFIGURATION:'Akun administrator dilindungi. Ubah penetapan admin melalui konfigurasi pemilik.'};
let generation=0,busy=false;
async function api(path,body){
 if(!auth.currentUser)throw Error('Silakan login melalui portal.');
 const token=await auth.currentUser.getIdToken();
 const response=await fetch('/api/admin/'+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),cache:'no-store'});
 const data=await response.json();if(!response.ok)throw Error(errors[data.error]||'Permintaan gagal. Periksa data dan coba lagi.');return data;
}
function node(tag,text){const el=document.createElement(tag);el.textContent=text;return el;}
async function load(){
 const current=++generation;
 const [data,log]=await Promise.all([api('users'),api('audit')]);if(current!==generation)return;
 $('admin-content').hidden=false;$('users').replaceChildren();$('link-uid').replaceChildren();$('requests').replaceChildren();$('audit').replaceChildren();
 for(const user of data.users){
  const box=node('article','');box.append(node('h3',user.name),node('p',(user.email||user.uid)+' · '+(user.active?'Aktif':'Nonaktif')));
  const button=node('button',user.active?'Nonaktifkan':'Aktifkan');button.className='secondary';button.addEventListener('click',()=>action(async()=>{if(!confirm('Ubah status akses portal untuk '+user.name+'? Sesi Project/Payment yang sudah berjalan belum otomatis dicabut.'))return;await api('user-status',{uid:user.uid,active:!user.active,revision:user.revision});await load();message('Status pengguna disimpan.');}));box.append(button);$('users').append(box);
  const option=node('option',user.name+' — '+(user.email||user.uid));option.value=user.uid;$('link-uid').append(option);
 }
 if(!data.users.length)$('users').append(node('p','Belum ada pengguna yang didaftarkan melalui pengaturan ini. Akun konfigurasi awal tetap dipertahankan.'));
 for(const item of data.requests){const box=node('article','');box.append(node('p',item.application+' · '+item.uid+' · '+(item.mode==='link'?'Hubungkan '+item.legacy_id:'Profil baru')+' · '+item.requested_role+' · Menunggu verifikasi'));const cancel=node('button','Batalkan pengaturan');cancel.className='secondary';cancel.addEventListener('click',()=>action(async()=>{await api('cancel-request',{id:item.id});await load();message('Pengaturan dibatalkan. Anda dapat membuat pengaturan pengganti.');}));box.append(cancel);$('requests').append(box);}
 for(const item of log.events)$('audit').append(node('p',item.created_at+' · '+item.action+' · '+item.target_uid));
}
async function action(fn){if(busy)return;busy=true;document.querySelectorAll('button').forEach(b=>b.disabled=true);try{await fn();}catch(e){message(e.message||'Permintaan gagal.');}finally{busy=false;document.querySelectorAll('button').forEach(b=>b.disabled=false);}}
$('refresh').addEventListener('click',()=>action(load));
$('create-mode').addEventListener('change',()=>{$('uid-field').hidden=$('create-mode').value==='new';$('user-uid').required=$('create-mode').value==='existing';});
$('user-form').addEventListener('submit',event=>{event.preventDefault();action(async()=>{
 // Verify administrator and database readiness before creating an Auth identity.
 await api('users');
 const email=$('user-email').value.trim(),name=$('user-name').value.trim();let uid=$('user-uid').value.trim(),created=false;
 if($('create-mode').value==='new'){
  const secondary=initializeApp(config,'provision-'+crypto.randomUUID());const secondaryAuth=getAuth(secondary);
  try{await setPersistence(secondaryAuth,inMemoryPersistence);const password=Array.from(crypto.getRandomValues(new Uint8Array(32)),x=>x.toString(16).padStart(2,'0')).join('');const result=await createUserWithEmailAndPassword(secondaryAuth,email,password);uid=result.user.uid;created=true;await signOut(secondaryAuth);}finally{await deleteApp(secondary);}
 }
 try{await api('users',{uid,email,name,active:true});}catch(error){if(created){$('create-mode').value='existing';$('uid-field').hidden=false;$('user-uid').value=uid;message('Akun Firebase sudah dibuat, tetapi penyimpanan akses belum terkonfirmasi. UID: '+uid+'. Muat ulang daftar sebelum mencoba mendaftarkan akun existing.');return;}throw error;}
 let sent=false;if(created){try{await sendPasswordResetEmail(auth,email);sent=true;}catch{}}
 $('user-form').reset();$('uid-field').hidden=true;await load();message(created?(sent?'Akun dibuat. Email pengaturan password telah diminta; periksa inbox/spam pengguna.':'Akun dibuat, tetapi email pengaturan password gagal dikirim. Gunakan Lupa password di portal.'):'Pengguna existing berhasil didaftarkan.');
 });});
function roles(){const payment=$('application').value==='payment';$('role').replaceChildren();for(const role of payment?['REVIEW_REQUIRED']:['UPLOADER','OPERATOR','SUPERVISOR','PLANNING','PROJEK','ADMIN']){const option=node('option',payment?'Ditentukan setelah pemeriksaan Payment':role);option.value=role;$('role').append(option);}}
$('application').addEventListener('change',roles);roles();
$('link-mode').addEventListener('change',()=>{const linked=$('link-mode').value==='link';$('legacy-field').hidden=!linked;$('legacy-id').required=linked;});
$('link-form').addEventListener('submit',event=>{event.preventDefault();action(async()=>{await api('link-requests',{uid:$('link-uid').value,application:$('application').value,mode:$('link-mode').value,legacyId:$('legacy-id').value,role:$('role').value,confirmed:$('confirmed').checked});await load();message('Pengaturan tersimpan sebagai menunggu verifikasi. Belum ada perubahan pada akun atau transaksi aplikasi tujuan.');});});
onAuthStateChanged(auth,user=>{generation++;$('admin-content').hidden=true;if(!user){message('Silakan login melalui portal terlebih dahulu.');return;}action(async()=>{await load();message('Kelola pengguna dan pengaturan koneksi aplikasi.');});});
