// Use Google's maintained verifier; no handwritten JWT validation or tokeninfo fallback.
import { OAuth2Client, CodeChallengeMethod } from 'google-auth-library';
import { createHash, randomBytes } from 'node:crypto';
import { AccessError } from './sessions.mjs';
const hash = value => createHash('sha256').update(value).digest('hex');
const loginCookie = '__Host-being-there-login';
export function createGoogleLogin({ clientId, clientSecret, appOrigin, repository, now = Date.now, client }) {
  if (!clientId || !clientSecret || new URL(appOrigin).protocol !== 'https:' || new URL(appOrigin).origin !== appOrigin) throw new Error('Google client credentials and exact HTTPS origin required');
  const redirectUri = appOrigin + '/auth/google/callback';
  const oauth = client ?? new OAuth2Client({ clientId, clientSecret, redirectUri });
  const cookie = value => loginCookie + '=' + value + '; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=600';
  return Object.freeze({
    async start() {
      const state = randomBytes(32).toString('base64url'), nonce = randomBytes(32).toString('base64url'), binding = randomBytes(32).toString('base64url');
      const { codeVerifier, codeChallenge } = await oauth.generateCodeVerifierAsync();
      repository.saveOAuth(hash(state), { bindingHash: hash(binding), nonce, codeVerifier, expiresAt: now() + 600000 });
      const location = oauth.generateAuthUrl({ scope: ['openid', 'email'], response_type: 'code', state, nonce,
        code_challenge: codeChallenge, code_challenge_method: CodeChallengeMethod.S256, prompt: 'select_account', max_age: '0' });
      return { location, cookie: cookie(binding) };
    },
    async verifyCallback(request) {
      const url = new URL(request.url);
      if (request.method !== 'GET' || url.origin !== appOrigin || url.pathname !== '/auth/google/callback' ||
          url.searchParams.getAll('state').length !== 1 || url.searchParams.getAll('code').length !== 1 || url.searchParams.has('error')) throw new AccessError(401);
      const state = url.searchParams.get('state'), code = url.searchParams.get('code');
      const matches = (request.headers.get('cookie') ?? '').split(';').map(v => v.trim()).filter(v => v.startsWith(loginCookie + '='));
      const binding = matches[0]?.slice(loginCookie.length + 1);
      if (!/^[A-Za-z0-9_-]{43}$/.test(state ?? '') || matches.length !== 1 || !/^[A-Za-z0-9_-]{43}$/.test(binding ?? '') || !code || code.length > 4096) throw new AccessError(401);
      // Atomic one-use consumption is browser-bound; wrong bindings do not consume it.
      const attempt = repository.consumeOAuth(hash(state), hash(binding));
      if (!attempt || attempt.expiresAt <= now()) throw new AccessError(401);
      let payload;
      try {
        const { tokens } = await oauth.getToken({ code, codeVerifier: attempt.codeVerifier, redirect_uri: redirectUri });
        if (!tokens.id_token) throw new Error('Missing identity');
        const ticket = await oauth.verifyIdToken({ idToken: tokens.id_token, audience: clientId });
        payload = ticket.getPayload();
      } catch { throw new AccessError(401); }
      const at = now();
      if (!payload || !['accounts.google.com', 'https://accounts.google.com'].includes(payload.iss) || payload.aud !== clientId ||
          payload.nonce !== attempt.nonce || typeof payload.sub !== 'string' || !payload.sub || payload.sub.length > 255 ||
          !Number.isInteger(payload.iat) || payload.iat * 1000 > at + 30000 || at - payload.iat * 1000 > 300000 ||
          // A newly minted ID token is not proof of a new interactive sign-in.
          // max_age=0 requires the OIDC auth_time claim; fail closed if absent/stale.
          !Number.isInteger(payload.auth_time) || payload.auth_time < 0 ||
          payload.auth_time > payload.iat || payload.auth_time * 1000 > at ||
          at - payload.auth_time * 1000 > 300000 ||
          !Number.isInteger(payload.exp) || payload.exp * 1000 <= at) throw new AccessError(401);
      const email = typeof payload.email === 'string' ? payload.email.toLowerCase() : null;
      // Google is authoritative for Gmail and verified Workspace domains. Do not
      // use a stale third-party email claim to accept another person's invitation.
      const domain = email?.split('@')[1];
      const authoritativeEmail = payload.email_verified === true && (domain === 'gmail.com' || (typeof payload.hd === 'string' && payload.hd.toLowerCase() === domain));
      return { issuer: 'https://accounts.google.com', subject: payload.sub, authenticatedAt: payload.auth_time * 1000, verifiedEmail: authoritativeEmail ? email : null };
    },
    clearCookie() { return loginCookie + '=; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=0'; }
  });
}
