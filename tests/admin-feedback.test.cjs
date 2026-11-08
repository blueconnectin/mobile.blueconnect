const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');
function setup(failure){
 const all=[];function element(tag){const el={tag,children:[],events:{},disabled:false,value:'project',_text:'',setAttribute(){},addEventListener(type,fn){this.events[type]=fn},append(...children){this.children.push(...children)},replaceChildren(...children){this.children=children;this._text=''},set textContent(v){this._text=v;this.children=[]},get textContent(){return this._text+this.children.map(c=>c.textContent).join('')}};all.push(el);return el;}
 const nodes={};for(const id of ['new-project','new-role-field','new-project-role','message','admin-content','users','link-uid','requests','audit','refresh','create-mode','uid-field','user-uid','user-form','application','role','link-mode','legacy-field','legacy-id','link-form'])nodes[id]=element('div');
 const profile={userId:'USR-123',username:'admin',name:'Admin',role:'ADMIN',status:'AKTIF'};
 const ctx={initializeApp:()=>({}),getAuth:()=>({currentUser:{getIdToken:async()=> 'not-a-real-token'}}),onAuthStateChanged:()=>{},document:{getElementById:id=>nodes[id],createElement:element,querySelectorAll:()=>all.filter(x=>x.tag==='button')},confirm:()=>true,fetch:async url=>{const data=url.endsWith('/users')?{users:[],requests:[{id:'request',application:'project',uid:'member',mode:'link',legacy_id:'USR-123',requested_role:'ADMIN'}]}:url.endsWith('/audit')?{events:[]}:failure?{error:'PROJECT_GOOGLE_AUTH_REQUIRED'}:{status:'verified',profile,employee:{name:'Admin'}};return {ok:!url.endsWith('/verify-project-link')||!failure,json:async()=>data}}};
 vm.runInNewContext(fs.readFileSync(__dirname+'/../public/admin.js','utf8').replace(/^import .*;\n/gm,''),ctx);return {ctx,nodes,all};
}
test('verification error is visible beside the clicked button and button recovers',async()=>{const t=setup(true);await t.ctx.load();const verify=t.all.find(e=>e.textContent==='Verifikasi akun');const running=verify.events.click();assert.match(t.nodes.requests.textContent,/Memproses permintaan/);await running;assert.match(t.nodes.requests.textContent,/PROJECT_GOOGLE_AUTH_REQUIRED/);assert.match(t.nodes.requests.textContent,/otorisasi Google/);assert.equal(verify.disabled,false)});
test('successful verification replaces progress with account preview and apply button',async()=>{const t=setup(false);await t.ctx.load();await t.all.find(e=>e.textContent==='Verifikasi akun').events.click();assert.match(t.nodes.requests.textContent,/Akun Project: admin/);assert.match(t.nodes.requests.textContent,/Terapkan hubungan akun/);assert.doesNotMatch(t.nodes.requests.textContent,/Memproses permintaan/)});

test('non-JSON platform failure shows HTTP status and safe reference without response body',async()=>{
 const t=setup(false);await t.ctx.load();
 t.ctx.fetch=async()=>({ok:false,status:502,headers:{get:()=> '1234567890abcdef-SIN'},json:async()=>{throw Error('<html>private diagnostics</html>')}});
 await t.all.find(e=>e.textContent==='Verifikasi akun').events.click();
 assert.match(t.nodes.requests.textContent,/HTTP 502/);
 assert.match(t.nodes.requests.textContent,/1234567890abcdef-SIN/);
 assert.doesNotMatch(t.nodes.requests.textContent,/private diagnostics/);
 assert.equal(t.all.find(e=>e.textContent==='Verifikasi akun').disabled,false);
});
test('invalid JSON shape fails visibly without showing untrusted header text',async()=>{
 const t=setup(false);await t.ctx.load();
 t.ctx.fetch=async()=>({ok:true,status:200,json:async()=>null});
 await t.all.find(e=>e.textContent==='Verifikasi akun').events.click();
 assert.match(t.nodes.requests.textContent,/Format respons API tidak sesuai/);
});
test('register employee with Project access provisions in order and reports partial failure',async()=>{
 for(const failApply of [false,true]){
 const t=setup(false),n=t.nodes;
 for(const id of ['user-email','user-name'])n[id]={value:id==='user-email'?'employee@example.com':'Employee'};
 n['create-mode'].value='existing';n['user-uid'].value='new-uid';
 n['new-project'].checked=true;n['new-project-role'].value='OPERATOR';n['user-form'].reset=()=>{};
 const calls=[];
 t.ctx.fetch=async(url,options)=>{
  const body=options.body?JSON.parse(options.body):null;
  if(body)calls.push({url,body});
  const data=!body?(url.endsWith('/users')?{users:[],requests:[]}:{events:[]}):url.endsWith('/link-requests')?{id:'new-request'}:url.endsWith('/apply-project-link')&&failApply?{error:'PROJECT_CONNECTION_FAILED'}:{success:true};
  return {ok:!(url.endsWith('/apply-project-link')&&failApply),json:async()=>data};
 };
 n['user-form'].events.submit({preventDefault(){}});
 for(let i=0;i<30;i++)await new Promise(r=>setImmediate(r));
 assert.deepEqual(calls.map(c=>c.url.split('/').pop()),['users','link-requests','verify-project-link','apply-project-link']);
 assert.equal(calls[1].body.mode,'new');assert.equal(calls[1].body.role,'OPERATOR');
 assert.equal(calls[2].body.id,'new-request');
 assert.match(n.message.textContent,failApply?/jangan buat akun Mobile ulang/:/Akses Project aktif/);
 }
});
