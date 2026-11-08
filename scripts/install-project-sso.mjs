// Applies the reviewed adapter to a local Project checkout; never pushes/deploys.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
const source=path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../integrations/project');
const root=process.argv[2] && path.resolve(process.argv[2]);
if(!root) throw Error('Usage: node scripts/install-project-sso.mjs /absolute/project-checkout');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const edits=new Map();
let rpc=read('Starlite-Documentation-source/20_NativeApiService.js');
if(!rpc.includes('loginWithPortal: loginWithPortal')) {
 if(!rpc.includes('loginWithSession: loginWithSession,') || !rpc.includes("anonymous = ['loginWithSession',")) throw Error('Project API changed; review adapter before applying');
 rpc=rpc.replace('loginWithSession: loginWithSession,','loginWithSession: loginWithSession,\n    loginWithPortal: loginWithPortal,');
 rpc=rpc.replace("anonymous = ['loginWithSession',", "anonymous = ['loginWithPortal', 'loginWithSession',");
}
for(const name of ['verifyPortalAccountLink','applyPortalAccountLink']){
 if(!rpc.includes(name+': '+name))rpc=rpc.replace('loginWithSession: loginWithSession,','loginWithSession: loginWithSession,\n    '+name+': '+name+',');
 if(!rpc.includes("anonymous = ['"+name+"',")){
  const start=rpc.indexOf('anonymous = [');const end=rpc.indexOf('].includes(request.method)',start);
  if(start<0||end<0)throw Error('Project anonymous dispatcher changed');
  if(!rpc.slice(start,end).includes("'"+name+"'"))rpc=rpc.slice(0,start)+rpc.slice(start).replace('anonymous = [',"anonymous = ['"+name+"', " );
 }
}
edits.set('Starlite-Documentation-source/20_NativeApiService.js',rpc);
const manifest=JSON.parse(read('Starlite-Documentation-source/appsscript.json'));
const scope='https://www.googleapis.com/auth/script.external_request';
if(!manifest.oauthScopes.includes(scope))manifest.oauthScopes.push(scope);
edits.set('Starlite-Documentation-source/appsscript.json',JSON.stringify(manifest,null,2)+'\n');
const methods=JSON.parse(read('cloudflare/rpc-methods.json'));
if(!Array.isArray(methods))throw Error('Unexpected RPC method configuration');
for(const name of ['loginWithPortal','verifyPortalAccountLink','applyPortalAccountLink'])if(!methods.includes(name))methods.push(name);
edits.set('cloudflare/rpc-methods.json',JSON.stringify(methods.sort(),null,2)+'\n');
edits.set('Starlite-Documentation-source/21_PortalSsoService.js',fs.readFileSync(path.join(source,'21_PortalSsoService.js'),'utf8'));
edits.set('Starlite-Documentation-source/22_PortalAccountService.js',fs.readFileSync(path.join(source,'22_PortalAccountService.js'),'utf8'));
for(const file of ['portal-login.html','portal-login.js'])edits.set('custom-domain/'+file,fs.readFileSync(path.join(source,file),'utf8'));
for(const [file,contents] of edits)fs.writeFileSync(path.join(root,file),contents);
execFileSync(process.execPath,['cloudflare/build-native.mjs'],{cwd:root,stdio:'inherit'});
console.log('Adapter prepared locally. Review changes, run Project tests, authorize Apps Script scope, then deploy backend before enabling SSO.');
