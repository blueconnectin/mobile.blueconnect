// Cloudflare Pages advanced-mode Worker. Configuration stays in server bindings.
const PROJECT_ID = 'blue-connect-mobile';
const JWKS_URL = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';
let keyCache;
let keyExpiry = 0;

function failure(code, status) { return Object.assign(new Error(code), { status }); }
function decode(part) {
  if (!/^[A-Za-z0-9_-]+$/.test(part)) throw failure('INVALID_TOKEN', 401);
  const raw = atob(part.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(part.length / 4) * 4, '='));
  return Uint8Array.from(raw, char => char.charCodeAt(0));
}
export async function verifyToken(token, options = {}) {
  const now = options.now ?? Math.floor(Date.now() / 1000);
  if (typeof token !== 'string' || token.length > 16000) throw failure('INVALID_TOKEN', 401);
  const parts = token.split('.');
  if (parts.length !== 3) throw failure('INVALID_TOKEN', 401);
  let header, claims;
  try {
    header = JSON.parse(new TextDecoder().decode(decode(parts[0])));
    claims = JSON.parse(new TextDecoder().decode(decode(parts[1])));
  } catch { throw failure('INVALID_TOKEN', 401); }
  if (!header || header.alg !== 'RS256' || typeof header.kid !== 'string' || !header.kid || header.crit) throw failure('INVALID_TOKEN', 401);
  if (!claims || claims.aud !== PROJECT_ID || claims.iss !== `https://securetoken.google.com/${PROJECT_ID}` ||
      typeof claims.sub !== 'string' || !claims.sub || claims.sub.length > 128 ||
      !Number.isInteger(claims.exp) || claims.exp <= now ||
      !Number.isInteger(claims.iat) || claims.iat > now || claims.exp <= claims.iat ||
      !Number.isInteger(claims.auth_time) || claims.auth_time > now || claims.auth_time > claims.iat) throw failure('INVALID_TOKEN', 401);
  const keys = await (options.getKeys || getKeys)();
  const jwk = keys.find(key => key.kid === header.kid && key.kty === 'RSA');
  if (!jwk) throw failure('INVALID_TOKEN', 401);
  try {
    const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, decode(parts[2]), new TextEncoder().encode(parts[0] + '.' + parts[1]));
    if (!valid) throw new Error('signature');
  } catch { throw failure('INVALID_TOKEN', 401); }
  return claims;
}
async function getKeys() {
  if (keyCache && Date.now() < keyExpiry) return keyCache;
  let response;
  try { response = await fetch(JWKS_URL, { signal: AbortSignal.timeout(8000) }); }
  catch { throw failure('AUTH_UNAVAILABLE', 503); }
  if (!response.ok) throw failure('AUTH_UNAVAILABLE', 503);
  let value;
  try { value = await response.json(); } catch { throw failure('AUTH_UNAVAILABLE', 503); }
  if (!Array.isArray(value.keys) || !value.keys.length) throw failure('AUTH_UNAVAILABLE', 503);
  const maxAge = Number((response.headers.get('Cache-Control') || '').match(/max-age=(\d+)/)?.[1] || 300);
  keyCache = value.keys;
  keyExpiry = Date.now() + Math.min(maxAge, 3600) * 1000;
  return keyCache;
}
export function getMember(uid, env) {
  let members;
  try { members = JSON.parse(env.PORTAL_MEMBERS_JSON || 'null'); } catch { throw failure('ACCESS_NOT_CONFIGURED', 503); }
  if (!members || typeof members !== 'object' || Array.isArray(members)) throw failure('ACCESS_NOT_CONFIGURED', 503);
  const member = Object.hasOwn(members, uid) ? members[uid] : null;
  if (!member || member.active !== true) throw failure('ACCESS_DENIED', 403);
  // Configuration is written by an administrator, never accepted from the client.
  return { name: typeof member.name === 'string' ? member.name : '',
    projectUserId: typeof member.project?.userId === 'string' ? member.project.userId : '',
    project: member.project?.enabled === true && typeof member.project.userId === 'string' && Boolean(member.project.userId),
    payment: member.payment?.enabled === true };
}
function json(value, status = 200) {
  return Response.json(value, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' } });
}
export async function handle(request, env, verifier = verifyToken) {
  const url = new URL(request.url);
  if (url.pathname === '/api/me' || url.pathname === '/api/project/identity') {
    if (request.method !== 'GET') return json({ error: 'METHOD_NOT_ALLOWED' }, 405);
    const authorization = request.headers.get('Authorization') || '';
    if (!authorization.startsWith('Bearer ') || authorization.length > 16007) return json({ error: 'UNAUTHENTICATED' }, 401);
    try {
      const claims = await verifier(authorization.slice(7));
      const member = getMember(claims.sub, env);
      if (url.pathname === '/api/project/identity') {
        if (env.PROJECT_SSO_ENABLED !== 'true') return json({ error: 'SSO_DISABLED' }, 503);
        if (!member.project) return json({ error: 'ACCESS_DENIED' }, 403);
        return json({ audience: 'blueconnect-project', uid: claims.sub, userId: member.projectUserId, expiresAt: claims.exp });
      }
      return json({ user: { uid: claims.sub, name: member.name }, apps: { project: member.project, payment: member.payment }, sso: { project: member.project && env.PROJECT_SSO_ENABLED === 'true', payment: false } });
    } catch (error) { return json({ error: error.status ? error.message : 'SERVICE_UNAVAILABLE' }, error.status || 503); }
  }
  if (url.pathname.startsWith('/api/')) return json({ error: 'NOT_FOUND' }, 404);
  if (!['GET', 'HEAD'].includes(request.method)) return json({ error: 'METHOD_NOT_ALLOWED' }, 405);
  return env.ASSETS.fetch(request);
}
export default { fetch(request, env) { return handle(request, env); } };
