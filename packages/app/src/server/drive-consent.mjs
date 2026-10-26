// Organizer-only, separately consented Google Drive OAuth. No Drive file API
// operations are performed here; refresh tokens stay in the family's own DB.
import { OAuth2Client, CodeChallengeMethod } from 'google-auth-library';
import { createHash, randomBytes } from 'node:crypto';
import { AccessError } from './sessions.mjs';
import { validateMembership, requireOrganizer } from './family-policy.mjs';

const digest = value => createHash('sha256').update(value).digest('hex');
const driveScope = 'https://www.googleapis.com/auth/drive.file';
const requestedScopes = ['openid', 'email', driveScope];
const returnedScopes = new Set([...requestedScopes, 'https://www.googleapis.com/auth/userinfo.email']);
const validId = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,80}$/.test(value);
const statePattern = /^[A-Za-z0-9_-]{43}$/;
const common = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer', Vary: 'Cookie' };
const json = (status, value) => new Response(JSON.stringify(value), { status, headers: { ...common, 'Content-Type': 'application/json; charset=utf-8' } });

export function createDriveConsent({ sessions, repository, appOrigin, clientId, clientSecret, now = Date.now, client }) {
  if (!clientId || !clientSecret || new URL(appOrigin).origin !== appOrigin || !appOrigin.startsWith('https://') ||
      !sessions || !repository || ['saveDriveAttempt', 'peekDriveAttempt', 'consumeDriveAttempt',
        'saveDriveConsent', 'getDriveConsentStatus', 'clearDriveConsent'].some(name => typeof repository[name] !== 'function'))
    throw new TypeError('Private family repository, verified sessions and exact HTTPS origin required');
  const redirectUri = appOrigin + '/auth/drive/callback';
  const oauth = client ?? new OAuth2Client({ clientId, clientSecret, redirectUri });

  async function authorize(request, familyId, { mutation = false, recent = false } = {}) {
    if (!validId(familyId)) throw new AccessError(404);
    const principal = await sessions.authenticate(request);
    const membership = validateMembership(await repository.getMembership(principal.accountId, familyId), principal.accountId, familyId);
    requireOrganizer(membership);
    if (mutation) sessions.requireMutation(request, principal, appOrigin);
    if (recent) sessions.requireRecentAuthentication(principal);
    const account = await repository.getAccount(principal.accountId);
    if (account?.id !== principal.accountId || account.issuer !== 'https://accounts.google.com' ||
        typeof account.subject !== 'string' || !account.subject) throw new AccessError(401);
    return { principal, account };
  }

  async function start(request, familyId) {
    const first = await authorize(request, familyId, { mutation: true, recent: true });
    const state = randomBytes(32).toString('base64url'), nonce = randomBytes(32).toString('base64url');
    const { codeVerifier, codeChallenge } = await oauth.generateCodeVerifierAsync();
    const latest = await authorize(request, familyId, { mutation: true, recent: true });
    if (latest.principal.sessionHash !== first.principal.sessionHash) throw new AccessError(401);
    repository.saveDriveAttempt(latest.principal, familyId, digest(state), {
      nonce, codeVerifier, expiresAt: now() + 600000
    });
    const location = oauth.generateAuthUrl({
      access_type: 'offline', prompt: 'consent select_account', response_type: 'code',
      scope: requestedScopes, include_granted_scopes: false, state, nonce,
      code_challenge: codeChallenge, code_challenge_method: CodeChallengeMethod.S256
    });
    return new Response(null, { status: 303, headers: { ...common, Location: location } });
  }

  async function callback(request) {
    const url = new URL(request.url);
    if (request.method !== 'GET' || url.pathname !== '/auth/drive/callback' ||
        url.searchParams.getAll('state').length !== 1 || url.searchParams.getAll('code').length !== 1 ||
        url.searchParams.has('error')) throw new AccessError(404);
    const state = url.searchParams.get('state'), code = url.searchParams.get('code');
    if (!statePattern.test(state ?? '') || typeof code !== 'string' || !code || code.length > 4096) throw new AccessError(404);
    const attempt = repository.peekDriveAttempt(digest(state));
    if (!attempt || attempt.expiresAt <= now()) throw new AccessError(404);
    const first = await authorize(request, attempt.familyId, { recent: true });
    if (first.principal.sessionHash !== attempt.sessionHash || first.principal.accountId !== attempt.accountId) throw new AccessError(404);
    const consumed = repository.consumeDriveAttempt(first.principal, attempt.familyId, digest(state));
    if (!consumed) throw new AccessError(404);
    // Last authorization boundary before the Google token endpoint is contacted.
    const beforeExchange = await authorize(request, attempt.familyId, { recent: true });
    if (beforeExchange.principal.sessionHash !== first.principal.sessionHash) throw new AccessError(401);
    let tokens, payload;
    try {
      ({ tokens } = await oauth.getToken({ code, codeVerifier: consumed.codeVerifier, redirect_uri: redirectUri }));
      if (!tokens?.id_token) throw new Error('Missing consent identity');
      const ticket = await oauth.verifyIdToken({ idToken: tokens.id_token, audience: clientId });
      payload = ticket.getPayload();
    } catch { throw new AccessError(401); }
    const scopes = new Set(typeof tokens.scope === 'string' ? tokens.scope.split(/\s+/).filter(Boolean) : []);
    if (!payload || !['accounts.google.com', 'https://accounts.google.com'].includes(payload.iss) ||
        payload.aud !== clientId || payload.nonce !== consumed.nonce ||
        payload.sub !== first.account.subject || !Number.isInteger(payload.exp) || payload.exp * 1000 <= now() ||
        !Number.isInteger(payload.iat) || payload.iat * 1000 > now() + 30000 ||
        !scopes.has(driveScope) || [...scopes].some(scope => !returnedScopes.has(scope)) ||
        typeof tokens.refresh_token !== 'string' || !tokens.refresh_token || tokens.refresh_token.length > 8192)
      throw new AccessError(401);
    // A revoked organizer or rotated session cannot persist the exchanged token.
    const latest = await authorize(request, attempt.familyId, { recent: true });
    if (latest.principal.sessionHash !== first.principal.sessionHash ||
        latest.account.subject !== first.account.subject) throw new AccessError(401);
    repository.saveDriveConsent(latest.principal, attempt.familyId, {
      refreshToken: tokens.refresh_token, scope: driveScope, subject: payload.sub, consentedAt: now(), generation: consumed.generation
    });
    return new Response(null, { status: 303, headers: { ...common, Location: '/?drive=connected' } });
  }

  async function handle(request) {
    try {
      const url = new URL(request.url);
      if (url.origin !== appOrigin) throw new AccessError(404);
      if (url.pathname === '/auth/drive/callback') return await callback(request);
      const route = /^\/api\/families\/([A-Za-z0-9_-]{1,80})\/drive\/(status|start|disconnect)$/.exec(url.pathname);
      if (!route) throw new AccessError(404);
      const [, familyId, action] = route;
      if (action === 'status' && request.method === 'GET') {
        const { principal } = await authorize(request, familyId);
        return json(200, repository.getDriveConsentStatus(principal, familyId));
      }
      if (action === 'start' && request.method === 'POST') return await start(request, familyId);
      if (action === 'disconnect' && request.method === 'POST') {
        const { principal } = await authorize(request, familyId, { mutation: true, recent: true });
        repository.clearDriveConsent(principal, familyId);
        return json(200, { connected: false });
      }
      throw new AccessError(405);
    } catch (error) {
      const status = error instanceof AccessError ? error.status : 503;
      return json(status, { error: ({ 401: 'Sign in required', 403: 'Request denied',
        404: 'Not found', 405: 'Method not allowed' })[status] ?? 'Service unavailable' });
    }
  }
  return Object.freeze({ handle });
}
