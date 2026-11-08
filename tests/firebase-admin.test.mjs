import {test} from 'node:test';
import assert from 'node:assert/strict';
import {setUserPassword,validatePassword} from '../public/firebase-admin.js';
test('password validation and missing credentials fail closed',async()=>{
 for(const password of ['',null,'short','x'.repeat(129)])assert.throws(()=>validatePassword(password),/INVALID_PASSWORD/);
 await assert.rejects(setUserPassword({},'uid','example-password'),/PASSWORD_ADMIN_NOT_CONFIGURED/);
});
test('password update exchanges signed credentials and targets the supplied UID',async()=>{
 const pair=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
 const privateKey=Buffer.from(await crypto.subtle.exportKey('pkcs8',pair.privateKey)).toString('base64');
 const env={FIREBASE_SERVICE_ACCOUNT_JSON:JSON.stringify({project_id:'blue-connect-mobile',client_email:'test@example.com',private_key:'-----BEGIN PRIVATE KEY-----\n'+privateKey+'\n-----END PRIVATE KEY-----'})};
 let calls=0;
 await setUserPassword(env,'target-uid','example-password',async(url,options)=>{
  calls++;
  if(calls===1){
   assert.equal(url,'https://oauth2.googleapis.com/token');
   const jwt=options.body.get('assertion'),parts=jwt.split('.');
   assert.equal(await crypto.subtle.verify('RSASSA-PKCS1-v1_5',pair.publicKey,Buffer.from(parts[2],'base64url'),new TextEncoder().encode(parts[0]+'.'+parts[1])),true);
   assert.doesNotMatch(jwt,/example-password/);
   return Response.json({access_token:'test-access'});
  }
  assert.equal(url,'https://identitytoolkit.googleapis.com/v1/projects/blue-connect-mobile/accounts:update');
  assert.equal(options.headers.Authorization,'Bearer test-access');
  assert.deepEqual(JSON.parse(options.body),{localId:'target-uid',password:'example-password'});
  return Response.json({localId:'target-uid'});
 });
 assert.equal(calls,2);
});
