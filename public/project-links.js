const fail=(code,status=409)=>Object.assign(Error(code),{status});
const pending="r.status='pending_review' AND NOT EXISTS (SELECT 1 FROM account_link_applied a WHERE a.request_id=r.id)";
export async function ensureLinkTables(db){
 await db.batch([
 db.prepare('CREATE TABLE IF NOT EXISTS account_link_verified (request_id TEXT PRIMARY KEY, actor_uid TEXT NOT NULL, user_revision INTEGER NOT NULL, profile TEXT NOT NULL, expires_at INTEGER NOT NULL)'),
 db.prepare('CREATE TABLE IF NOT EXISTS account_link_applied (request_id TEXT PRIMARY KEY, uid TEXT UNIQUE NOT NULL, project_user_id TEXT UNIQUE NOT NULL, operation_id TEXT UNIQUE NOT NULL, actor_uid TEXT NOT NULL, applied_at TEXT NOT NULL)')
 ]);
}
async function context(db,id){
 const row=await db.prepare(`SELECT r.*,u.name,u.active,u.revision,u.project_user_id FROM account_requests r JOIN portal_users u ON u.uid=r.uid WHERE r.id=? AND ${pending}`).bind(id).first();
 if(!row)throw fail('REQUEST_NOT_PENDING');
 if(row.application!=='project')throw fail('PAYMENT_CONNECTOR_NOT_READY');
 if(row.active!==1)throw fail('TARGET_USER_INACTIVE');
 if(row.project_user_id && (row.mode!=='link'||row.project_user_id!==row.legacy_id))throw fail('EXISTING_LINK_REASSIGNMENT_BLOCKED');
 return row;
}
function configurationConflict(env,uid,target){
 let entries;try{entries=JSON.parse(env.PORTAL_MEMBERS_JSON||'{}');}catch{throw fail('ACCESS_NOT_CONFIGURED',503);}
 for(const [other,value] of Object.entries(entries))if(other!==uid && value?.project?.enabled===true && value.project.userId===target)throw fail('ACCOUNT_ALREADY_LINKED');
}
function profileValid(profile,row){
 if(!profile || typeof profile.userId!=='string'||!profile.userId||typeof profile.username!=='string'||typeof profile.name!=='string'||profile.status!=='AKTIF')throw fail('PROJECT_ACCOUNT_INVALID');
 if(profile.role!==row.requested_role)throw fail('PROJECT_ROLE_MISMATCH');
 if(row.mode==='link'&&profile.userId!==row.legacy_id)throw fail('PROJECT_ACCOUNT_INVALID');
 return {userId:profile.userId,username:profile.username,name:profile.name,role:profile.role,status:profile.status};
}
export function projectRemoteError(data) {
 const code=String(data?.error?.message||data?.error?.code||'');
 const known={PORTAL_ADMIN_REQUIRED:'PROJECT_ADMIN_AUTH_FAILED',PORTAL_AUTH_FAILED:'PROJECT_ADMIN_AUTH_FAILED',PORTAL_USER_NOT_FOUND:'PROJECT_USER_NOT_FOUND',PORTAL_ACCOUNT_ROLE_OR_STATUS_CHANGED:'PROJECT_ACCOUNT_ROLE_OR_STATUS_CHANGED',PORTAL_DUPLICATE_USER:'PROJECT_ACCOUNT_INVALID',PORTAL_ACCOUNT_COLLISION:'ACCOUNT_ALREADY_LINKED',INVALID_REQUEST:'PROJECT_BACKEND_OUTDATED'};
 if(known[code])return known[code];
 if(/permission|authorization is required|otorisasi|izin.*UrlFetchApp/i.test(code))return 'PROJECT_GOOGLE_AUTH_REQUIRED';
 return 'PROJECT_VERIFICATION_FAILED';
}
export async function remote(env,request,method,id){
 const url=env.PROJECT_APPS_SCRIPT_URL || 'https://script.google.com/macros/s/AKfycbzCiIpWJZiO0d6EiBXGZHMLLEWvbPj5vapmryLEHXKYB7TooJKpIbSUpAXro1EQN-w/exec';
 if(!/^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec$/.test(url))throw fail('PROJECT_CONNECTOR_NOT_CONFIGURED',503);
 const token=(request.headers.get('Authorization')||'').slice(7);
 let response,data;
 try{response=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({protocol:1,method,args:[token,id],sessionToken:''}),redirect:'follow',signal:AbortSignal.timeout(45000)});}
 catch{throw fail('PROJECT_CONNECTION_FAILED',424);}
 if(!response.ok)throw fail('PROJECT_UPSTREAM_REJECTED',424);
 try{data=await response.json();}catch{throw fail('PROJECT_RESPONSE_NOT_JSON',424);}
 if(!data?.ok)throw fail(projectRemoteError(data),424);
 if(!data.result?.profile)throw fail('PROJECT_VERIFICATION_FAILED',424);
 return data.result.profile;
}

export async function projectAuthorization(env,claims,url){
 const db=env.PORTAL_DB,row=await context(db,url.searchParams.get('requestId'));
 const apply=url.searchParams.get('phase')==='apply';
 if(apply){
  const proof=await db.prepare('SELECT * FROM account_link_verified WHERE request_id=?').bind(row.id).first();
  if(!proof||proof.actor_uid!==claims.sub||proof.expires_at<=Date.now()||proof.user_revision!==row.revision)throw fail('VERIFICATION_REQUIRED');
 }
 return {audience:'blueconnect-project-admin',actor:claims.sub,requestId:row.id,uid:row.uid,name:row.name,mode:row.mode,legacyId:row.legacy_id,role:row.requested_role,phase:apply?'apply':'verify',expiresAt:Math.floor(Date.now()/1000)+60};
}
export async function processProjectLink(request,env,claims,input,apply,connector=remote){
 if(typeof input.id!=='string'||!input.id)throw fail('INVALID_REQUEST',400);
 const db=env.PORTAL_DB;
 const completed=await db.prepare('SELECT project_user_id FROM account_link_applied WHERE request_id=?').bind(input.id).first();
 if(completed)return {success:true,status:'applied',userId:completed.project_user_id};
 const row=await context(db,input.id);
 let proof;
 if(apply){
  if(input.confirmed!==true)throw fail('CONFIRMATION_REQUIRED',400);
  proof=await db.prepare('SELECT * FROM account_link_verified WHERE request_id=?').bind(row.id).first();
  if(!proof||proof.actor_uid!==claims.sub||proof.expires_at<=Date.now()||proof.user_revision!==row.revision)throw fail('VERIFICATION_REQUIRED');
 }
 const profile=profileValid(await connector(env,request,apply?'applyPortalAccountLink':'verifyPortalAccountLink',row.id),row);
 configurationConflict(env,row.uid,profile.userId);
 const other=await db.prepare('SELECT uid FROM portal_users WHERE project_user_id=? AND uid<>?').bind(profile.userId,row.uid).first();
 if(other)throw fail('ACCOUNT_ALREADY_LINKED');
 if(!apply){
  await db.prepare('INSERT INTO account_link_verified(request_id,actor_uid,user_revision,profile,expires_at) VALUES(?,?,?,?,?) ON CONFLICT(request_id) DO UPDATE SET actor_uid=excluded.actor_uid,user_revision=excluded.user_revision,profile=excluded.profile,expires_at=excluded.expires_at').bind(row.id,claims.sub,row.revision,JSON.stringify(profile),Date.now()+300000).run();
  return {status:'verified',profile,employee:{uid:row.uid,name:row.name},expiresInSeconds:300};
 }
 if(JSON.stringify(profile)!==proof.profile)throw fail('PROJECT_ACCOUNT_CHANGED');
 const operation=crypto.randomUUID(),at=new Date().toISOString();
 let results;
 try{results=await db.batch([
 db.prepare(`INSERT INTO account_link_applied(request_id,uid,project_user_id,operation_id,actor_uid,applied_at) SELECT r.id,r.uid,?,?,?,? FROM account_requests r JOIN portal_users u ON u.uid=r.uid WHERE r.id=? AND ${pending} AND u.active=1 AND u.revision=? AND EXISTS(SELECT 1 FROM account_link_verified v WHERE v.request_id=r.id AND v.actor_uid=? AND v.profile=? AND v.expires_at>?)`).bind(profile.userId,operation,claims.sub,at,row.id,row.revision,claims.sub,proof.profile,Date.now()),
 db.prepare('UPDATE portal_users SET project_user_id=?,project_enabled=1,revision=revision+1,updated_at=? WHERE uid=? AND EXISTS(SELECT 1 FROM account_link_applied WHERE operation_id=?)').bind(profile.userId,at,row.uid,operation),
 db.prepare("INSERT INTO portal_audit(id,actor_uid,action,target_uid,detail,created_at) SELECT ?,?,'APPLY_PROJECT_LINK',?,?,? WHERE EXISTS(SELECT 1 FROM account_link_applied WHERE operation_id=?)").bind(crypto.randomUUID(),claims.sub,row.uid,JSON.stringify({requestId:row.id,profile}),at,operation)
 ]);}catch(error){if(/UNIQUE constraint/i.test(String(error)))throw fail('ACCOUNT_ALREADY_LINKED');throw error;}
 if(!results[0].meta.changes)throw fail('CONFLICT_REFRESH_REQUIRED');
 return {success:true,status:'applied',userId:profile.userId};
}
