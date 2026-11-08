/** Canonical source: Mobile repository. No password/hash returned to portal. */
function portalAccountAuthorization_(idToken, requestId, phase) {
  if (typeof idToken !== 'string' || idToken.length > 16000 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(idToken) || typeof requestId !== 'string' || !/^[A-Za-z0-9-]{1,100}$/.test(requestId)) throw new Error('PORTAL_AUTH_FAILED');
  var url='https://mobile.blueconnect.id/api/admin/project-authorization?requestId='+encodeURIComponent(requestId)+'&phase='+phase;
  var response=UrlFetchApp.fetch(url,{headers:{Authorization:'Bearer '+idToken},muteHttpExceptions:true,followRedirects:false,validateHttpsCertificates:true});
  if(response.getResponseCode()!==200)throw new Error('PORTAL_ADMIN_REQUIRED');
  var auth=JSON.parse(response.getContentText());
  if(!auth||auth.audience!=='blueconnect-project-admin'||auth.requestId!==requestId||auth.phase!==phase||!auth.actor||!auth.uid||typeof auth.name!=='string'||typeof auth.expiresAt!=='number'||auth.expiresAt<=Math.floor(Date.now()/1000)||!isSupportedUserRole_(auth.role)||!['new','link'].includes(auth.mode))throw new Error('PORTAL_AUTH_FAILED');
  return auth;
}
function portalAccountTarget_(auth, create) {
  var sh=getSheet_(APP.SHEETS.USERS),values=sh.getDataRange().getValues();
  if(!values.length)throw new Error('PORTAL_USER_SCHEMA_INVALID');
  var headers=values[0],cols={};
  ['USER_ID','USERNAME','PASSWORD_HASH','NAMA','ROLE','STATUS'].forEach(function(name){cols[name]=headers.indexOf(name);if(cols[name]<0)throw new Error('PORTAL_USER_SCHEMA_INVALID');});
  var suffix=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,auth.uid,Utilities.Charset.UTF_8).map(function(b){return ((b+256)%256).toString(16).padStart(2,'0');}).join('').slice(0,32);
  var id=auth.mode==='link'?auth.legacyId:'USR-M-'+suffix;
  if(typeof id!=='string'||!id)throw new Error('PORTAL_USER_NOT_FOUND');
  var matches=values.slice(1).filter(function(row){return String(row[cols.USER_ID]).trim()===id;});
  if(matches.length>1)throw new Error('PORTAL_DUPLICATE_USER');
  if(matches.length){
    var row=matches[0];
    if(auth.mode==='new'&&(headers.indexOf('PORTAL_UID')<0||row[headers.indexOf('PORTAL_UID')]!==auth.uid))throw new Error('PORTAL_ACCOUNT_COLLISION');
    var profile={userId:id,username:String(row[cols.USERNAME]),name:String(row[cols.NAMA]),role:String(row[cols.ROLE]).trim().toUpperCase(),status:String(row[cols.STATUS]).trim().toUpperCase()};
    if(profile.status!=='AKTIF'||profile.role!==auth.role)throw new Error('PORTAL_ACCOUNT_ROLE_OR_STATUS_CHANGED');
    return profile;
  }
  if(auth.mode==='link')throw new Error('PORTAL_USER_NOT_FOUND');
  var username='mobile_'+suffix,profile={userId:id,username:username,name:auth.name,role:auth.role,status:'AKTIF'};
  if(values.slice(1).some(function(row){return String(row[cols.USERNAME]).toLowerCase()===username;}))throw new Error('PORTAL_ACCOUNT_COLLISION');
  if(!create)return profile;
  var portalCol=headers.indexOf('PORTAL_UID');
  if(portalCol<0){portalCol=headers.length;sh.getRange(1,portalCol+1).setValue('PORTAL_UID');headers.push('PORTAL_UID');}
  var record=headers.map(function(){return '';});
  record[cols.USER_ID]=id;record[cols.USERNAME]=username;record[cols.NAMA]=auth.name;record[cols.ROLE]=auth.role;record[cols.STATUS]='AKTIF';record[portalCol]=auth.uid;
  record[cols.PASSWORD_HASH]=hashPassword_(Utilities.getUuid()+Utilities.getUuid()+Utilities.getUuid());
  if(headers.indexOf('CREATED_AT')>=0)record[headers.indexOf('CREATED_AT')]=now_();
  sh.appendRow(record);
  return profile;
}
function verifyPortalAccountLink(idToken, requestId) {
  var auth=portalAccountAuthorization_(idToken,requestId,'verify');
  return {profile:portalAccountTarget_(auth,false)};
}
function applyPortalAccountLink(idToken, requestId) {
  var auth=portalAccountAuthorization_(idToken,requestId,'apply');
  var lock=LockService.getScriptLock();lock.waitLock(20000);
  try{return {profile:portalAccountTarget_(auth,true)};}finally{lock.releaseLock();}
}
