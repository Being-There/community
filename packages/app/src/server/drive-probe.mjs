// Private, organizer-only Google Drive API acceptance probe.
// This is deliberately NOT a file listing, upload, backup or public token endpoint.
import { OAuth2Client } from 'google-auth-library';
import { AccessError } from './sessions.mjs';
import { validateMembership, requireOrganizer } from './family-policy.mjs';

const validId = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,80}$/.test(value);
const scope = 'https://www.googleapis.com/auth/drive.file';
const aboutUrl = 'https://www.googleapis.com/drive/v3/about?fields=kind';
const headers = Object.freeze({ 'Cache-Control': 'private, no-store',
  'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', Vary: 'Cookie' });
const json = (status, value) => new Response(JSON.stringify(value), { status,
  headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8' } });

export function createDriveProbe({ sessions, repository, appOrigin, clientId, clientSecret,
  refreshAccessToken, driveFetch = fetch }) {
  if (!appOrigin?.startsWith('https://') || new URL(appOrigin).origin !== appOrigin ||
      !clientId || !clientSecret || !sessions || !repository ||
      typeof repository.getDriveCredential !== 'function' ||
      typeof repository.getMembership !== 'function' || typeof repository.getAccount !== 'function' ||
      typeof driveFetch !== 'function' ||
      (refreshAccessToken !== undefined && typeof refreshAccessToken !== 'function'))
    throw new TypeError('Exact HTTPS origin, private Drive consent and session authority required');

  // Construct a fresh OAuth client per request: never share cached Google
  // credentials between families or put refresh tokens into browser responses.
  const refresh = refreshAccessToken ?? (async refreshToken => {
    const oauth = new OAuth2Client({ clientId, clientSecret });
    oauth.setCredentials({ refresh_token: refreshToken });
    const result = await oauth.getAccessToken();
    return result?.token;
  });

  return Object.freeze({
    async handle(request) {
      try {
        const url = new URL(request.url);
        const match = /^\/api\/families\/([A-Za-z0-9_-]{1,80})\/drive\/verify$/.exec(url.pathname);
        if (url.origin !== appOrigin || !match || url.search || request.method !== 'POST' ||
            !validId(match[1])) throw new AccessError(404);
        const familyId = match[1];

        async function authorize() {
          const principal = await sessions.authenticate(request);
          const membership = validateMembership(
            await repository.getMembership(principal.accountId, familyId), principal.accountId, familyId);
          requireOrganizer(membership);
          sessions.requireMutation(request, principal, appOrigin);
          sessions.requireRecentAuthentication(principal);
          const account = await repository.getAccount(principal.accountId);
          if (account?.id !== principal.accountId || account.issuer !== 'https://accounts.google.com' ||
              !account.subject) throw new AccessError(401);
          return { principal, subject: account.subject };
        }
        const initial = await authorize();
        const beforeCredential = await authorize();
        if (initial.principal.sessionHash !== beforeCredential.principal.sessionHash ||
            initial.subject !== beforeCredential.subject) throw new AccessError(401);

        // Credential loading happens ONLY after the fresh organizer, family,
        // CSRF and recent-Google-session checks above.
        const credential = repository.getDriveCredential(beforeCredential.principal, familyId);
        if (!credential || credential.scope !== scope || credential.subject !== initial.subject)
          throw new AccessError(404);

        let token;
        try { token = await refresh(credential.refreshToken); }
        catch { throw new AccessError(503); }
        if (typeof token !== 'string' || !token || token.length > 8192) throw new AccessError(503);

        async function stillAuthorized() {
          const latest = await authorize();
          if (latest.principal.sessionHash !== initial.principal.sessionHash ||
              latest.subject !== initial.subject) throw new AccessError(401);
          const current = repository.getDriveCredential(latest.principal, familyId);
          if (!current || current.scope !== credential.scope ||
              current.subject !== credential.subject ||
              current.generation !== credential.generation ||
              current.refreshToken !== credential.refreshToken) throw new AccessError(404);
        }

        // Revocation or disconnect during refresh prevents ANY Drive API call.
        await stillAuthorized();
        let response;
        try {
          response = await driveFetch(aboutUrl, {
            method: 'GET', redirect: 'error', cache: 'no-store',
            headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' }
          });
        } catch { throw new AccessError(503); }
        if (response?.status !== 200) throw new AccessError(503);
        // Even a successful in-flight Drive call must not return success after
        // the organizer loses family authority or disconnects Drive.
        await stillAuthorized();
        return json(200, { verified: true });
      } catch (error) {
        const status = error instanceof AccessError ? error.status : 503;
        return json(status, { error: ({ 401: 'Sign in required', 403: 'Request denied',
          404: 'Not found' })[status] ?? 'Service unavailable' });
      }
    }
  });
}
