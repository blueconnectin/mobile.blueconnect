import {ensureLinkTables,projectAuthorization,processProjectLink} from './project-links.js';
// Imported only by the Worker. No credentials or data embedded in this module.
export function isPortalAdmin(uid, env) {
  try { const ids=JSON.parse(env.PORTAL_ADMIN_UIDS || '[]'); return Array.isArray(ids) && ids.includes(uid); }
  catch { return false; }
}
export async function databaseMember(uid, env) {
  if (!env.PORTAL_DB) return null;
  const row=await env.PORTAL_DB.prepare('SELECT * FROM portal_users WHERE uid = ?').bind(uid).first();
  if(!row)return null;
  if(row.active!==1)throw Object.assign(Error('ACCESS_DENIED'),{status:403});
  return {name:row.name,projectUserId:row.project_user_id||'',project:row.project_enabled===1 && Boolean(row.project_user_id),payment:false};
}
const err=(message,status=400)=>Object.assign(Error(message),{status});
export function validateUser(input){
 const uid=typeof input.uid==='string'?input.uid.trim():'';
 const name=typeof input.name==='string'?input.name.trim():'';
 const email=typeof input.email==='string'?input.email.trim().toLowerCase():'';
 if(!uid||uid.length>128||!name||name.length>120||email.length>254||(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))||typeof input.active!=='boolean')throw err('INVALID_USER');
 return {uid,name,email,active:input.active?1:0};
}
export function validateRequest(input){
 if(!['project','payment'].includes(input.application)||!['new','link'].includes(input.mode))throw err('INVALID_LINK');
 const roles={project:['ADMIN','UPLOADER','OPERATOR','SUPERVISOR','PLANNING','PROJEK'],payment:['REVIEW_REQUIRED']};
 if(!roles[input.application].includes(input.role))throw err('INVALID_ROLE');
 const legacyId=input.mode==='link'&&typeof input.legacyId==='string'?input.legacyId.trim():null;
 if(input.mode==='link'&&(!legacyId||legacyId.length>128))throw err('LEGACY_ACCOUNT_REQUIRED');
 if(input.confirmed!==true)throw err('CONFIRMATION_REQUIRED');
 return {application:input.application,mode:input.mode,role:input.role,legacyId};
}
function audit(db,actor,action,target,detail,at){return db.prepare('INSERT INTO portal_audit(id,actor_uid,action,target_uid,detail,created_at) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),actor,action,target,JSON.stringify(detail),at);}
export async function adminApi(request,env,claims){
 if(!isPortalAdmin(claims.sub,env))throw err('ADMIN_REQUIRED',403);
 if(!env.PORTAL_DB)throw err('DATABASE_NOT_CONFIGURED',503);
 const db=env.PORTAL_DB,url=new URL(request.url),at=new Date().toISOString();
 await ensureLinkTables(db);
 if(request.method==='GET'&&url.pathname==='/api/admin/project-authorization')return projectAuthorization(env,claims,url);
 if(request.method==='GET'&&url.pathname==='/api/admin/users'){
  const users=await db.prepare('SELECT uid,email,name,active,project_enabled,project_user_id,revision,updated_at FROM portal_users ORDER BY name LIMIT 200').all();
  const requests=await db.prepare("SELECT r.* FROM account_requests r WHERE r.status='pending_review' AND NOT EXISTS(SELECT 1 FROM account_link_applied a WHERE a.request_id=r.id) ORDER BY r.created_at DESC LIMIT 200").all();
  return {users:users.results,requests:requests.results};
 }
 if(request.method==='GET'&&url.pathname==='/api/admin/audit')return {events:(await db.prepare('SELECT * FROM portal_audit ORDER BY created_at DESC LIMIT 100').all()).results};
 if(request.method!=='POST')throw err('METHOD_NOT_ALLOWED',405);
 if(request.headers.get('Origin')!==url.origin)throw err('ORIGIN_DENIED',403);
 if(!(request.headers.get('Content-Type')||'').startsWith('application/json'))throw err('JSON_REQUIRED',415);
 const raw=await request.text();if(raw.length>12000)throw err('PAYLOAD_TOO_LARGE',413);
 let input;try{input=JSON.parse(raw);}catch{throw err('INVALID_JSON');}
 if(!input||typeof input!=='object'||Array.isArray(input))throw err('INVALID_JSON');
 if(url.pathname==='/api/admin/verify-project-link')return processProjectLink(request,env,claims,input,false);
 if(url.pathname==='/api/admin/apply-project-link')return processProjectLink(request,env,claims,input,true);
 if(url.pathname==='/api/admin/users'){
  const user=validateUser(input);
  if(!user.active && isPortalAdmin(user.uid,env))throw err('ADMIN_DEACTIVATION_REQUIRES_CONFIGURATION',409);
  // Existing Firebase identity registration only; never invent an authentication account.
  const existing=await db.prepare('SELECT * FROM portal_users WHERE uid=?').bind(user.uid).first();
  if(existing)throw err('USER_ALREADY_EXISTS',409);
  let previous;try{previous=JSON.parse(env.PORTAL_MEMBERS_JSON||'{}')[user.uid];}catch{}
  const previousId=previous?.project?.enabled===true && typeof previous.project.userId==='string' ? previous.project.userId : null;
  await db.batch([
   db.prepare('INSERT INTO portal_users(uid,email,name,active,project_enabled,project_user_id,updated_at) VALUES(?,?,?,?,?,?,?)').bind(user.uid,user.email,user.name,user.active,previousId?1:0,previousId,at),
   audit(db,claims.sub,'REGISTER_USER',user.uid,{name:user.name,email:user.email,active:user.active},at)
  ]);return {success:true};
 }
 if(url.pathname==='/api/admin/user-status'){
  if(typeof input.uid!=='string'||typeof input.active!=='boolean'||!Number.isInteger(input.revision))throw err('INVALID_USER');
  if(!input.active&&isPortalAdmin(input.uid,env))throw err('ADMIN_DEACTIVATION_REQUIRES_CONFIGURATION',409);
  // Optimistic update; audit inserted only when revision matches within the same batch.
  const id=crypto.randomUUID();
  const result=await db.batch([
   db.prepare('INSERT INTO portal_audit(id,actor_uid,action,target_uid,detail,created_at) SELECT ?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM portal_users WHERE uid=? AND revision=?)').bind(id,claims.sub,'SET_ACTIVE',input.uid,JSON.stringify({active:input.active}),at,input.uid,input.revision),
   db.prepare('UPDATE portal_users SET active=?, revision=revision+1,updated_at=? WHERE uid=? AND revision=?').bind(input.active?1:0,at,input.uid,input.revision)
  ]);
  if(!result[1].meta.changes)throw err('CONFLICT_REFRESH_REQUIRED',409);return {success:true};
 }
 if(url.pathname==='/api/admin/cancel-request'){
  if(typeof input.id!=='string')throw err('INVALID_REQUEST');
  const item=await db.prepare("SELECT r.* FROM account_requests r WHERE r.id=? AND r.status='pending_review' AND NOT EXISTS(SELECT 1 FROM account_link_applied a WHERE a.request_id=r.id)").bind(input.id).first();if(!item)throw err('REQUEST_NOT_PENDING',409);
  await db.batch([
   db.prepare("INSERT INTO portal_audit(id,actor_uid,action,target_uid,detail,created_at) SELECT ?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM account_requests WHERE id=? AND status='pending_review' AND NOT EXISTS(SELECT 1 FROM account_link_applied WHERE request_id=account_requests.id))").bind(crypto.randomUUID(),claims.sub,'CANCEL_ACCOUNT_LINK',item.uid,JSON.stringify({id:input.id}),at,input.id),
   db.prepare("UPDATE account_requests SET status='cancelled' WHERE id=? AND status='pending_review' AND NOT EXISTS(SELECT 1 FROM account_link_applied WHERE request_id=account_requests.id)").bind(input.id)
  ]);return {success:true};
 }
 if(url.pathname==='/api/admin/link-requests'){
  if(typeof input.uid!=='string')throw err('INVALID_USER');
  const item=validateRequest(input);
  const user=await db.prepare('SELECT uid FROM portal_users WHERE uid=?').bind(input.uid).first();if(!user)throw err('USER_NOT_FOUND',404);
  if(item.application==='project'&&item.legacyId){const used=await db.prepare('SELECT uid FROM portal_users WHERE project_user_id=? AND uid<>?').bind(item.legacyId,input.uid).first();if(used)throw err('ACCOUNT_ALREADY_LINKED',409);}
  const conflict=await db.prepare("SELECT id FROM account_requests WHERE status='pending_review' AND (uid=? AND application=? OR legacy_id=? AND application=?)").bind(input.uid,item.application,item.legacyId,item.application).first();if(conflict)throw err('REQUEST_ALREADY_PENDING',409);
  const requestId=crypto.randomUUID();
  try {await db.batch([
   db.prepare('INSERT INTO account_requests(id,uid,application,mode,legacy_id,requested_role,created_by,created_at) VALUES(?,?,?,?,?,?,?,?)').bind(requestId,input.uid,item.application,item.mode,item.legacyId,item.role,claims.sub,at),
   audit(db,claims.sub,'REQUEST_ACCOUNT_LINK',input.uid,item,at)
  ]);}catch(error){if(/UNIQUE constraint/i.test(String(error)))throw err('REQUEST_ALREADY_PENDING',409);throw error;}
  return {success:true,status:'pending_review',id:requestId};
 }
 throw err('NOT_FOUND',404);
}
