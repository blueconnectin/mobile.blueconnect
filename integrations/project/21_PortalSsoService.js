/** SSO adapter. Source of truth: blueconnectin/mobile.blueconnect. */
function loginWithPortal(idToken) {
  if (PropertiesService.getScriptProperties().getProperty('PORTAL_SSO_ENABLED') !== 'true') {
    throw new Error('PORTAL_SSO_DISABLED');
  }
  if (typeof idToken !== 'string' || idToken.length > 16000 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(idToken)) {
    throw new Error('PORTAL_AUTH_FAILED');
  }
  var response;
  try {
    response = UrlFetchApp.fetch('https://mobile.blueconnect.id/api/project/identity', {
      method: 'get', headers: { Authorization: 'Bearer ' + idToken },
      muteHttpExceptions: true, followRedirects: false, validateHttpsCertificates: true
    });
  } catch (error) { throw new Error('PORTAL_AUTH_UNAVAILABLE'); }
  if (response.getResponseCode() !== 200) throw new Error('PORTAL_AUTH_FAILED');
  var identity;
  try { identity = JSON.parse(response.getContentText()); } catch (error) { throw new Error('PORTAL_AUTH_FAILED'); }
  if (!identity || identity.audience !== 'blueconnect-project' || !identity.uid ||
      typeof identity.userId !== 'string' || !identity.userId ||
      typeof identity.expiresAt !== 'number' || identity.expiresAt <= Math.floor(Date.now() / 1000)) {
    throw new Error('PORTAL_AUTH_FAILED');
  }
  var values = getSheet_(APP.SHEETS.USERS).getDataRange().getValues();
  if (values.length < 2) throw new Error('PORTAL_USER_NOT_FOUND');
  var headers = values[0];
  var names = ['USER_ID', 'USERNAME', 'NAMA', 'ROLE', 'STATUS'];
  var cols = names.map(function(name) { return headers.indexOf(name); });
  if (cols.some(function(col) { return col < 0; })) throw new Error('PORTAL_USER_SCHEMA_INVALID');
  var matches = values.slice(1).filter(function(row) { return String(row[cols[0]]).trim() === identity.userId; });
  if (matches.length !== 1) throw new Error('PORTAL_USER_NOT_FOUND');
  var row = matches[0], role = String(row[cols[3]]).trim().toUpperCase();
  if (String(row[cols[4]]).trim().toUpperCase() !== 'AKTIF' || !isSupportedUserRole_(role)) throw new Error('PORTAL_USER_INACTIVE');
  // Role always comes from Project's USERS sheet, never from portal/browser input.
  var user = { userId: identity.userId, username: String(row[cols[1]]), nama: String(row[cols[2]]), role: role };
  var token = createSession_(user);
  return { success: true, token: token, user: user };
}

/** Run once as deployer to authorize external_request; creates no user/session. */
function authorizePortalConnection_() {
  var response = UrlFetchApp.fetch('https://mobile.blueconnect.id/api/project/identity', {
    muteHttpExceptions: true, followRedirects: false
  });
  // A 401 means the protected endpoint was reached successfully without credentials.
  return { reachable: response.getResponseCode() === 401, status: response.getResponseCode() };
}
