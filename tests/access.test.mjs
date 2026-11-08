import {test} from 'node:test';
import assert from 'node:assert/strict';
import {verifyToken, getMember, handle} from '../public/_worker.js';
const now=2000000000;
const pair=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
const jwk={...await crypto.subtle.exportKey('jwk',pair.publicKey),kid:'test-key'};
const b64=x=>Buffer.from(typeof x==='string'?x:JSON.stringify(x)).toString('base64url');
async function token(overrides={},header={alg:'RS256',kid:'test-key'}){
 const claims={aud:'blue-connect-mobile',iss:'https://securetoken.google.com/blue-connect-mobile',sub:'member-1',iat:now-10,auth_time:now-20,exp:now+300,...overrides};
 const input=b64(header)+'.'+b64(claims);
 const signature=await crypto.subtle.sign('RSASSA-PKCS1-v1_5',pair.privateKey,new TextEncoder().encode(input));
 return input+'.'+Buffer.from(signature).toString('base64url');
}
const opts={now,getKeys:async()=>[jwk]};
test('valid Firebase-shaped RSA token verifies',async()=>assert.equal((await verifyToken(await token(),opts)).sub,'member-1'));
for(const [name,claims] of Object.entries({expired:{exp:now},audience:{aud:'other-project'},issuer:{iss:'other'},future:{iat:now+10},missingUid:{sub:''},missingAuthTime:{auth_time:null}}))test('reject '+name,async()=>assert.rejects(verifyToken(await token(claims),opts),/INVALID_TOKEN/));
test('reject unsigned algorithm and unknown key',async()=>{await assert.rejects(verifyToken(await token({},{alg:'none',kid:'test-key'}),opts));await assert.rejects(verifyToken(await token({},{alg:'RS256',kid:'unknown'}),opts))});
test('reject tampered signature',async()=>{const t=await token();const parts=t.split('.');parts[1]=b64({sub:'attacker',aud:'blue-connect-mobile',iss:'https://securetoken.google.com/blue-connect-mobile',iat:now-10,auth_time:now-20,exp:now+300});await assert.rejects(verifyToken(parts.join('.'),opts),/INVALID_TOKEN/)});
test('unconfigured, unlisted and inactive accounts fail closed',()=>{assert.throws(()=>getMember('x',{}),/ACCESS_NOT_CONFIGURED/);assert.throws(()=>getMember('x',{PORTAL_MEMBERS_JSON:'{}'}),/ACCESS_DENIED/);assert.throws(()=>getMember('x',{PORTAL_MEMBERS_JSON:'{"x":{"active":false}}'}),/ACCESS_DENIED/)});
const env={PORTAL_MEMBERS_JSON:JSON.stringify({'member-1':{active:true,name:'User',project:{enabled:true,userId:'USR-123'},payment:{enabled:false}}})};
test('API verifies identity and returns only configured access',async()=>{const response=await handle(new Request('https://mobile.blueconnect.id/api/me',{headers:{Authorization:'Bearer '+await token()}}),env,t=>verifyToken(t,opts));assert.equal(response.status,200);assert.equal(response.headers.get('Cache-Control'),'no-store');const body=await response.json();assert.deepEqual(body.apps,{project:true,payment:false});assert.equal(body.sso.project,false);assert.equal(JSON.stringify(body).includes('USR-123'),false)});
test('API refuses missing token, invalid token and disabled membership',async()=>{assert.equal((await handle(new Request('https://mobile.blueconnect.id/api/me'),env)).status,401);assert.equal((await handle(new Request('https://mobile.blueconnect.id/api/me',{headers:{Authorization:'Bearer forged'}}),env)).status,401);const r=await handle(new Request('https://mobile.blueconnect.id/api/me',{headers:{Authorization:'Bearer '+await token()}}),{PORTAL_MEMBERS_JSON:'{}'},t=>verifyToken(t,opts));assert.equal(r.status,403)});
test('client-controlled query cannot grant access',async()=>{const r=await handle(new Request('https://mobile.blueconnect.id/api/me?uid=member-1&role=ADMIN',{headers:{Authorization:'Bearer '+await token({sub:'attacker'})}}),env,t=>verifyToken(t,opts));assert.equal(r.status,403)});
test('SSO identity is disabled by default and requires project membership',async()=>{
 const request=()=>new Request('https://mobile.blueconnect.id/api/project/identity',{headers:{Authorization:'Bearer placeholder'}});
 const verify=async()=>({sub:'member-1',exp:now+300});
 assert.equal((await handle(request(),env,verify)).status,503);
 const enabled={...env,PROJECT_SSO_ENABLED:'true'};
 const response=await handle(request(),enabled,verify);
 assert.deepEqual(await response.json(),{audience:'blueconnect-project',uid:'member-1',userId:'USR-123',expiresAt:now+300});
 assert.equal((await handle(request(),{PROJECT_SSO_ENABLED:'true',PORTAL_MEMBERS_JSON:'{"member-1":{"active":true,"project":{"enabled":false,"userId":"USR-123"}}}'},verify)).status,403);
});
