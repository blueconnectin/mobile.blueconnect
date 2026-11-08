import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {launchProjectSso} from '../public/project-sso.js';
const script=fs.readFileSync(new URL('../integrations/project/21_PortalSsoService.js',import.meta.url),'utf8');
function backend(options={}){
 const calls=[]; const values=[['USER_ID','USERNAME','NAMA','ROLE','STATUS'],['USR-123','admin','Admin','ADMIN','AKTIF']];
 if(options.inactive)values[1][4]='NONAKTIF';
 if(options.duplicate)values.push(values[1]);
 const ctx={PropertiesService:{getScriptProperties:()=>({getProperty:()=>options.disabled?'false':'true'})},UrlFetchApp:{fetch:(url,opts)=>{calls.push({url,opts});return {getResponseCode:()=>options.http||200,getContentText:()=>JSON.stringify(options.identity||{audience:'blueconnect-project',uid:'member-1',userId:'USR-123',expiresAt:Math.floor(Date.now()/1000)+300,role:'OPERATOR'})}}},APP:{SHEETS:{USERS:'USERS'}},getSheet_:()=>({getDataRange:()=>({getValues:()=>values})}),isSupportedUserRole_:r=>['ADMIN','OPERATOR'].includes(r),createSession_:u=>{calls.push(u);return 'project-session'}};
 vm.runInNewContext(script,ctx);return {login:ctx.loginWithPortal,calls};
}
test('Project creates session from verified mapping and local role',()=>{const b=backend();const r=b.login('aaa.bbb.ccc');assert.equal(r.user.role,'ADMIN');assert.equal(r.user.userId,'USR-123');assert.equal(r.token,'project-session');assert.equal(b.calls[0].url,'https://mobile.blueconnect.id/api/project/identity');assert.equal(b.calls[0].opts.followRedirects,false)});
for(const [label,options] of Object.entries({disabled:{disabled:true},inactive:{inactive:true},duplicate:{duplicate:true},denied:{http:403},redirect:{http:302},wrongAudience:{identity:{audience:'other',uid:'x',userId:'USR-123',expiresAt:9999999999}},expired:{identity:{audience:'blueconnect-project',uid:'x',userId:'USR-123',expiresAt:1}},unmapped:{identity:{audience:'blueconnect-project',uid:'x',userId:'USR-other',expiresAt:9999999999}}}))test('Project rejects '+label,()=>assert.throws(()=>backend(options).login('aaa.bbb.ccc')));
test('Project rejects malformed token before remote lookup',()=>{const b=backend();assert.throws(()=>b.login('not-token'));assert.equal(b.calls.length,0)});
test('portal handoff ignores wrong origins/windows and binds result nonce',async()=>{
 let listener;const messages=[];let tokenReads=0;const child={postMessage:(data,origin)=>messages.push({data,origin})};const statuses=[];
 const win={open:(url)=>{assert.equal(url,'https://project.blueconnect.id/portal-login.html');return child},addEventListener:(type,fn)=>listener=fn,removeEventListener:()=>{}};
 const cleanup=launchProjectSso({getIdToken:async()=>{tokenReads++;return 'id-token'}},m=>statuses.push(m),win);
 const nonce='a'.repeat(64),data={type:'BLUECONNECT_PROJECT_READY',nonce};
 try {
 await listener({origin:'https://evil.example',source:child,data});await listener({origin:'https://project.blueconnect.id',source:{},data});assert.equal(tokenReads,0);
 await listener({origin:'https://project.blueconnect.id',source:child,data});assert.equal(tokenReads,1);assert.equal(messages[0].origin,'https://project.blueconnect.id');assert.equal(messages[0].data.nonce,nonce);
 await listener({origin:'https://project.blueconnect.id',source:child,data});assert.equal(tokenReads,1);
 await listener({origin:'https://project.blueconnect.id',source:child,data:{type:'BLUECONNECT_PROJECT_RESULT',nonce:'wrong',ok:true}});assert.equal(statuses.at(-1),'Menghubungkan akun ke Project…');
 await listener({origin:'https://project.blueconnect.id',source:child,data:{type:'BLUECONNECT_PROJECT_RESULT',nonce,ok:true}});assert.match(statuses.at(-1),/berhasil dibuka/);
 }finally{cleanup()}
});
test('popup blocked gives actionable feedback without retrieving a token',()=>{let msg;launchProjectSso({getIdToken:()=>{throw Error('must not call')}},s=>msg=s,{open:()=>null});assert.match(msg,/pop-up/)});
