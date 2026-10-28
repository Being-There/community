// Creates one private, family-owned Drive folder after fresh organizer authorization.
// This never lists unrelated files, shares a link or exposes provider credentials.
import { OAuth2Client } from 'google-auth-library';
import { AccessError } from './sessions.mjs';
import { validateMembership, requireOrganizer } from './family-policy.mjs';

const scope = 'https://www.googleapis.com/auth/drive.file';
const mime = 'application/vnd.google-apps.folder';
const folderName = 'Being There Archive';
const endpoint = 'https://www.googleapis.com/drive/v3/files?fields=id,name,mimeType';
const responseHeaders = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer', Vary: 'Cookie' };
const json = (status, value) => new Response(JSON.stringify(value), { status,
  headers: { ...responseHeaders, 'Content-Type': 'application/json; charset=utf-8' } });

export function createDriveFolder({ sessions, repository, appOrigin, clientId, clientSecret,
  refreshAccessToken, driveFetch = fetch }) {
  if (!appOrigin?.startsWith('https://') || new URL(appOrigin).origin !== appOrigin ||
      !clientId || !clientSecret || !sessions || !repository || typeof driveFetch !== 'function' ||
      ['getMembership', 'getAccount', 'getDriveCredential', 'getDriveFolder',
        'reserveDriveFolder', 'finishDriveFolder'].some(key => typeof repository[key] !== 'function') ||
      (refreshAccessToken !== undefined && typeof refreshAccessToken !== 'function'))
    throw new TypeError('Private Drive repository, verified sessions and exact HTTPS origin required');

  const refresh = refreshAccessToken ?? (async refreshToken => {
    const oauth = new OAuth2Client({ clientId, clientSecret });
    oauth.setCredentials({ refresh_token: refreshToken });
    return (await oauth.getAccessToken())?.token;
  });

  return Object.freeze({ async handle(request) {
    try {
      const url = new URL(request.url);
      const match = /^\/api\/families\/([A-Za-z0-9_-]{1,80})\/drive\/folder$/.exec(url.pathname);
      if (url.origin !== appOrigin || !match || url.search || request.method !== 'POST')
        throw new AccessError(404);
      const familyId = match[1];
      async function authorize() {
        const principal = await sessions.authenticate(request);
        requireOrganizer(validateMembership(
          await repository.getMembership(principal.accountId, familyId), principal.accountId, familyId));
        sessions.requireMutation(request, principal, appOrigin);
        sessions.requireRecentAuthentication(principal);
        const account = await repository.getAccount(principal.accountId);
        if (account?.id !== principal.accountId || account.issuer !== 'https://accounts.google.com' ||
            typeof account.subject !== 'string' || !account.subject) throw new AccessError(401);
        return { principal, subject: account.subject };
      }
      const first = await authorize();
      const second = await authorize();
      if (second.principal.sessionHash !== first.principal.sessionHash ||
          second.subject !== first.subject) throw new AccessError(401);

      // No credential is even loaded for a denied identity, role or CSRF.
      const credential = repository.getDriveCredential(second.principal, familyId);
      if (!credential || credential.scope !== scope || credential.subject !== first.subject)
        throw new AccessError(404);
      const existing = repository.getDriveFolder(second.principal, familyId);
      if (existing?.state === 'ready') return json(200, { folderId: existing.id, created: false });
      if (existing) throw new AccessError(409);

      let token;
      try { token = await refresh(credential.refreshToken); }
      catch { throw new AccessError(503); }
      if (typeof token !== 'string' || !token || token.length > 8192) throw new AccessError(503);

      async function stillAuthorized() {
        const current = await authorize();
        if (current.principal.sessionHash !== first.principal.sessionHash ||
            current.subject !== first.subject) throw new AccessError(401);
        const latest = repository.getDriveCredential(current.principal, familyId);
        if (!latest || latest.subject !== credential.subject ||
            latest.scope !== credential.scope || latest.generation !== credential.generation ||
            latest.refreshToken !== credential.refreshToken) throw new AccessError(404);
        return current.principal;
      }
      // Disconnect or revocation during token refresh causes zero Drive calls.
      const current = await stillAuthorized();
      // Atomic reservation prevents two simultaneous requests from creating two folders.
      const claim = repository.reserveDriveFolder(current, familyId, credential);
      await stillAuthorized();
      let response;
      try {
        response = await driveFetch(endpoint, { method: 'POST', redirect: 'error', cache: 'no-store',
          headers: { Authorization: 'Bearer ' + token, Accept: 'application/json',
            'Content-Type': 'application/json' },
          body: JSON.stringify({ name: folderName, mimeType: mime }) });
      } catch { throw new AccessError(503); }
      if (response?.status !== 200 && response?.status !== 201) throw new AccessError(503);
      let result;
      try { result = await response.json(); } catch { throw new AccessError(503); }
      if (!result || typeof result.id !== 'string' || !/^[A-Za-z0-9_-]{10,200}$/.test(result.id) ||
          result.mimeType !== mime || result.name !== folderName) throw new AccessError(503);
      // A revoked/disconnected request may have already reached Drive, but cannot
      // persist or disclose the folder. A pending claim prevents unsafe retries.
      const final = await stillAuthorized();
      repository.finishDriveFolder(final, familyId, claim, result.id);
      return json(201, { folderId: result.id, created: true });
    } catch (error) {
      const status = error instanceof AccessError ? error.status : 503;
      return json(status, { error: ({ 401: 'Sign in required', 403: 'Request denied',
        404: 'Not found', 409: 'Folder creation pending; operator recovery required' })[status] ?? 'Service unavailable' });
    }
  } });
}
