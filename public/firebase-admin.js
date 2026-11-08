const fail=(message,status=400)=>Object.assign(Error(message),{status});
export function validatePassword(password){
 if(typeof password!=='string'||password.length<8||password.length>128)throw fail('INVALID_PASSWORD');
 return password;
}
export async function setUserPassword(env,uid,password,fetcher=fetch){
 validatePassword(password);
 let account;try{account=JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_JSON||'null');}catch{}
 if(!account||account.project_id!=='blue-connect-mobile'||typeof account.client_email!=='string'||typeof account.private_key!=='string')throw fail('PASSWORD_ADMIN_NOT_CONFIGURED',503);
 const b64=bytes=>btoa(String.fromCharCode(...bytes)).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
 const encode=value=>b64(new TextEncoder().encode(JSON.stringify(value)));
 const now=Math.floor(Date.now()/1000);
 let access;
 try{
  const raw=atob(account.private_key.replace(/-----[^-]+-----/g,'').replace(/\s/g,''));
  const key=await crypto.subtle.importKey('pkcs8',Uint8Array.from(raw,c=>c.charCodeAt(0)),{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['sign']);
  const payload=encode({alg:'RS256',typ:'JWT'})+'.'+encode({iss:account.client_email,scope:'https://www.googleapis.com/auth/identitytoolkit',aud:'https://oauth2.googleapis.com/token',iat:now,exp:now+3600});
  const signature=await crypto.subtle.sign('RSASSA-PKCS1-v1_5',key,new TextEncoder().encode(payload));
  const response=await fetcher('https://oauth2.googleapis.com/token',{method:'POST',body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:payload+'.'+b64(new Uint8Array(signature))}),signal:AbortSignal.timeout(15000)});
  const data=await response.json();if(!response.ok||!data.access_token)throw Error();
  access=data.access_token;
 }catch{throw fail('PASSWORD_ADMIN_AUTH_FAILED',424);}
 let response;try{
  response=await fetcher('https://identitytoolkit.googleapis.com/v1/projects/blue-connect-mobile/accounts:update',{method:'POST',headers:{Authorization:'Bearer '+access,'Content-Type':'application/json'},body:JSON.stringify({localId:uid,password}),signal:AbortSignal.timeout(15000)});
 }catch{throw fail('PASSWORD_UPDATE_UNCONFIRMED',424);}
 if(!response.ok)throw fail('PASSWORD_UPDATE_FAILED',424);
}
