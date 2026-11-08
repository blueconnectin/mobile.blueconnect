const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
function setup(fail=false){
 const nodes={}; for(const id of ['status','login-form','email','password','reset','logout','login','home','identity','submit','project-link','payment-link','access-status','retry-access','sso-note','admin-link']) nodes[id]={textContent:'',value:'',hidden:false,disabled:false,events:{},addEventListener(k,fn){this.events[k]=fn},reportValidity(){return !!this.value}};
 let observer; const calls=[];
 const context={document:{getElementById:id=>nodes[id],querySelectorAll:()=>[nodes.submit,nodes.reset,nodes.logout]},initializeApp:c=>c,getAuth:()=>({}),browserSessionPersistence:'session',setPersistence:async()=>calls.push('persistence'),signInWithEmailAndPassword:async(a,e,p)=>{calls.push([e,p]);if(fail)throw {code:'auth/invalid-credential'}},onAuthStateChanged:(a,fn)=>observer=fn,signOut:async()=>calls.push('logout'),sendPasswordResetEmail:async()=>calls.push('reset')};
 vm.runInNewContext(fs.readFileSync(__dirname+'/../public/app.js','utf8').replace(/^import .*;\n/gm,''),context);
 return {nodes,calls,observe:u=>observer(u)};
}
const tick=()=>new Promise(r=>setImmediate(r));
test('successful login uses session persistence and clears password',async()=>{const t=setup();t.nodes.email.value=' user@example.com ';t.nodes.password.value='secret';t.nodes['login-form'].events.submit({preventDefault(){}});await tick();assert.equal(t.calls[0],'persistence');assert.equal(t.calls[1][0],'user@example.com');assert.equal(t.nodes.password.value,'');assert.equal(t.nodes.submit.disabled,false)});
test('failed login shows generic message and re-enables buttons',async()=>{const t=setup(true);t.nodes['login-form'].events.submit({preventDefault(){}});await tick();assert.match(t.nodes.status.textContent,/belum berhasil/);assert.equal(t.nodes.submit.disabled,false)});
test('auth state controls portal and renders identity as text',()=>{const t=setup();t.observe({email:'<img onerror=alert(1)>'});assert.equal(t.nodes.login.hidden,true);assert.equal(t.nodes.home.hidden,false);assert.equal(t.nodes.identity.textContent,'<img onerror=alert(1)>');t.observe(null);assert.equal(t.nodes.home.hidden,true);assert.equal(t.nodes.identity.textContent,'')});
test('reset requires an email before making a request',async()=>{const t=setup();t.nodes.reset.events.click();await tick();assert.equal(t.calls.length,0);t.nodes.email.value='user@example.com';t.nodes.reset.events.click();await tick();assert.equal(t.calls[0],'reset');assert.match(t.nodes.status.textContent,/Jika email terdaftar/)});

