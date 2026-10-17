import { readFile } from 'node:fs/promises';
import { webcrypto } from 'node:crypto';
import { createSessionService } from './sessions.mjs';
import { createFamilyApi } from './family-api.mjs';
import { createFamilyWriteApi } from './family-write-api.mjs';
import { createGoogleLogin } from './google-login.mjs';
export function createApplication({ repository, appOrigin, googleClientId, googleClientSecret, googleClient, now = Date.now }) {
  const google = createGoogleLogin({ clientId: googleClientId, clientSecret: googleClientSecret, appOrigin, repository, now, client: googleClient });
  const sessions = createSessionService({ repository, now, verifyIdentity: async request => {
    const identity = await google.verifyCallback(request); repository.ensureVerifiedAccount(identity); return identity;
  } });
  const readApi = createFamilyApi({ sessions, repository, appOrigin, subtleCrypto: webcrypto.subtle });
  const api = createFamilyWriteApi({ sessions, repository, appOrigin, readApi });
  const assets = new Map([
    ['/', ['../app/index.html', 'text/html; charset=utf-8']],
    ['/app.js', ['../app/app.js', 'text/javascript; charset=utf-8']],
    ['/style.css', ['../app/style.css', 'text/css; charset=utf-8']],
    ['/modules/recording-recovery.mjs', ['../core/recording-recovery.mjs', 'text/javascript; charset=utf-8']]
  ]);
  const security = { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer',
    'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' blob:; media-src 'self' blob:; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
    'Permissions-Policy': 'camera=(), microphone=(self), geolocation=()', 'Cross-Origin-Resource-Policy': 'same-origin' };
  async function handle(request) {
    const url = new URL(request.url);
    if (url.origin !== appOrigin) return new Response('Not found', { status: 404, headers: security });
    if (url.pathname === '/auth/google/start' || url.pathname === '/auth/google/callback') {
      try {
        if (request.method !== 'GET') return new Response('Method not allowed', { status: 405, headers: security });
        if (url.pathname.endsWith('/start')) {
          const result = await google.start(); return new Response(null, { status: 303, headers: { ...security, Location: result.location, 'Set-Cookie': result.cookie } });
        }
        const result = await sessions.signIn(request, request);
        const response = new Response(null, { status: 303, headers: { ...security, Location: '/' } });
        for (const cookie of [result.sessionCookie, result.csrfCookie, google.clearCookie()]) response.headers.append('Set-Cookie', cookie);
        return response;
      } catch { return new Response('Sign-in could not be completed. Return to the app and try again.', { status: 401, headers: security }); }
    }
    if (url.pathname.startsWith('/api/')) return api(request);
    if (url.pathname === '/health' && request.method === 'GET') return new Response('ok', { headers: security });
    const asset = assets.get(url.pathname);
    if (!asset || !['GET', 'HEAD'].includes(request.method)) return new Response('Not found', { status: 404, headers: security });
    const bytes = await readFile(new URL(asset[0], import.meta.url));
    return new Response(request.method === 'HEAD' ? null : bytes, { headers: { ...security, 'Content-Type': asset[1] } });
  }
  return Object.freeze({ handle, sessions });
}
