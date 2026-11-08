import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import fs from 'node:fs';
import {adminApi,databaseMember} from '../public/admin-api.js';
function setup(){
 const sqlite=new DatabaseSync(':memory:');sqlite.exec(fs.readFileSync(new URL('../migrations/0001_users.sql',import.meta.url),'utf8'));
 function statement(sql,args=[]){return {bind(...values){return statement(sql,values)},async first(){return sqlite.prepare(sql).get(...args)||null},async all(){return {results:sqlite.prepare(sql).all(...args)}},run(){const r=sqlite.prepare(sql).run(...args);return {meta:{changes:Number(r.changes)}}}}};const db={prepare:statement,async batch(statements){sqlite.exec('BEGIN');try{const results=statements.map(s=>s.run());sqlite.exec('COMMIT');return results}catch(e){sqlite.exec('ROLLBACK');throw e}}};
 const env={PORTAL_DB:db,PORTAL_ADMIN_UIDS:'["admin"]'};
 const request=(path,body,uid='admin',origin='https://mobile.blueconnect.id')=>adminApi(new Request('https://mobile.blueconnect.id/api/admin/'+path,{method:body?'POST':'GET',headers:{Origin:origin,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})}),env,{sub:uid});return {env,request,sqlite};
}
const user={uid:'employee',name:'Employee',email:'employee@example.com',active:true};
test('admin writes persist and audit is recorded atomically',async()=>{const t=setup();await t.request('users',user);const data=await t.request('users');assert.equal(data.users.length,1);assert.equal(data.users[0].name,'Employee');assert.equal((await t.request('audit')).events[0].action,'REGISTER_USER');t.sqlite.close()});
test('non-admin and foreign origin cannot write',async()=>{const t=setup();await assert.rejects(t.request('users',user,'employee'),/ADMIN_REQUIRED/);await assert.rejects(t.request('users',user,'admin','https://evil.example'),/ORIGIN_DENIED/);assert.equal((await t.request('users')).users.length,0);t.sqlite.close()});
test('inactive database membership blocks fallback and stale writes do not audit',async()=>{const t=setup();await t.request('users',user);await t.request('user-status',{uid:user.uid,active:false,revision:1});await assert.rejects(databaseMember(user.uid,t.env),/ACCESS_DENIED/);await assert.rejects(t.request('user-status',{uid:user.uid,active:true,revision:1}),/CONFLICT/);assert.equal((await t.request('audit')).events.length,2);t.sqlite.close()});
test('link requests never alter active access and reserve legacy ID across users',async()=>{const t=setup();await t.request('users',user);await t.request('users',{...user,uid:'other'});const body={uid:user.uid,application:'project',mode:'link',legacyId:'USR-123',role:'ADMIN',confirmed:true};await t.request('link-requests',body);assert.equal((await databaseMember(user.uid,t.env)).project,false);await assert.rejects(t.request('link-requests',{...body,uid:'other'}),/REQUEST_ALREADY_PENDING/);assert.equal((await t.request('users')).requests[0].status,'pending_review');t.sqlite.close()});
test('Payment roles and link confirmation are validated',async()=>{const t=setup();await t.request('users',user);await assert.rejects(t.request('link-requests',{uid:user.uid,application:'payment',mode:'new',role:'ADMIN',confirmed:true}),/INVALID_ROLE/);await assert.rejects(t.request('link-requests',{uid:user.uid,application:'project',mode:'new',role:'ADMIN',confirmed:false}),/CONFIRMATION_REQUIRED/);t.sqlite.close()});
test('registering existing configured user preserves Project mapping',async()=>{const t=setup();t.env.PORTAL_MEMBERS_JSON=JSON.stringify({employee:{project:{enabled:true,userId:'USR-LEGACY'}}});await t.request('users',user);assert.equal((await databaseMember('employee',t.env)).projectUserId,'USR-LEGACY');t.sqlite.close()});
test('cancel request retains audit and allows replacement',async()=>{const t=setup();await t.request('users',user);const body={uid:user.uid,application:'project',mode:'link',legacyId:'USR-123',role:'OPERATOR',confirmed:true};await t.request('link-requests',body);const first=(await t.request('users')).requests[0];await t.request('cancel-request',{id:first.id});await t.request('link-requests',{...body,legacyId:'USR-456'});assert.equal((await t.request('users')).requests[0].legacy_id,'USR-456');assert.equal((await t.request('audit')).events.length,4);t.sqlite.close()});

import {processProjectLink,projectAuthorization} from '../public/project-links.js';
const profile={userId:'USR-123',username:'legacy',name:'Legacy User',role:'OPERATOR',status:'AKTIF'};
async function pendingRequest(t,mode='link'){
 await t.request('users',user);
 await t.request('link-requests',{uid:user.uid,application:'project',mode,legacyId:mode==='link'?'USR-123':null,role:'OPERATOR',confirmed:true});
 return (await t.request('users')).requests[0].id;
}
const fakeRequest=new Request('https://mobile.blueconnect.id/api/admin/verify-project-link',{headers:{Authorization:'Bearer token'}});
const connect=async()=>({...profile});
test('verify then apply commits mapping and audit once; repeat is idempotent',async()=>{
 const t=setup(),id=await pendingRequest(t);
 const preview=await processProjectLink(fakeRequest,t.env,{sub:'admin'},{id},false,connect);
 assert.equal(preview.status,'verified');assert.equal((await databaseMember(user.uid,t.env)).project,false);
 assert.equal((await processProjectLink(fakeRequest,t.env,{sub:'admin'},{id,confirmed:true},true,connect)).status,'applied');
 assert.equal((await databaseMember(user.uid,t.env)).projectUserId,'USR-123');
 const count=(await t.request('audit')).events.length;
 await processProjectLink(fakeRequest,t.env,{sub:'admin'},{id,confirmed:true},true,()=>{throw Error('must not call again')});
 assert.equal((await t.request('audit')).events.length,count);assert.equal((await t.request('users')).requests.length,0);
 await assert.rejects(t.request('cancel-request',{id}),/REQUEST_NOT_PENDING/);t.sqlite.close();
});
test('cannot apply without verification, with another admin or stale revision',async()=>{
 const t=setup(),id=await pendingRequest(t);
 await assert.rejects(processProjectLink(fakeRequest,t.env,{sub:'admin'},{id,confirmed:true},true,connect),/VERIFICATION_REQUIRED/);
 await processProjectLink(fakeRequest,t.env,{sub:'admin'},{id},false,connect);
 await assert.rejects(processProjectLink(fakeRequest,t.env,{sub:'other-admin'},{id,confirmed:true},true,connect),/VERIFICATION_REQUIRED/);
 await t.request('user-status',{uid:user.uid,active:true,revision:1});
 await assert.rejects(processProjectLink(fakeRequest,t.env,{sub:'admin'},{id,confirmed:true},true,connect),/VERIFICATION_REQUIRED/);t.sqlite.close();
});
test('changed identity, cancellation and config ownership block application',async()=>{
 const t=setup(),id=await pendingRequest(t);
 t.env.PORTAL_MEMBERS_JSON='{"someone-else":{"project":{"enabled":true,"userId":"USR-123"}}}';
 await assert.rejects(processProjectLink(fakeRequest,t.env,{sub:'admin'},{id},false,connect),/ACCOUNT_ALREADY_LINKED/);
 t.env.PORTAL_MEMBERS_JSON='{}';await processProjectLink(fakeRequest,t.env,{sub:'admin'},{id},false,connect);
 await assert.rejects(processProjectLink(fakeRequest,t.env,{sub:'admin'},{id,confirmed:true},true,async()=>({...profile,name:'Changed'})),/PROJECT_ACCOUNT_CHANGED/);
 await t.request('cancel-request',{id});await assert.rejects(processProjectLink(fakeRequest,t.env,{sub:'admin'},{id,confirmed:true},true,connect),/REQUEST_NOT_PENDING/);t.sqlite.close();
});
test('server authorization returns only trusted request and requires apply proof',async()=>{
 const t=setup(),id=await pendingRequest(t);
 const url=new URL('https://mobile.blueconnect.id/api/admin/project-authorization?requestId='+id+'&phase=apply');
 await assert.rejects(projectAuthorization(t.env,{sub:'admin'},url),/VERIFICATION_REQUIRED/);
 await processProjectLink(fakeRequest,t.env,{sub:'admin'},{id},false,connect);
 const auth=await projectAuthorization(t.env,{sub:'admin'},url);assert.equal(auth.uid,user.uid);assert.equal(auth.role,'OPERATOR');assert.equal(auth.legacyId,'USR-123');t.sqlite.close();
});
