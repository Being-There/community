import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generateKeyPairSync, sign, createHash } from 'node:crypto';
import { OAuth2Client } from 'google-auth-library';
import { openFamilyRepository } from '../../src/server/sqlite-repository.mjs';
import { createApplication } from '../../src/server/application.mjs';
export const origin = 'https://family.example.test';
export const clientId = 'fictional-client.apps.googleusercontent.com';
export async function integratedFixture(t, { originOverride, driveClient } = {}) {
  const appOrigin = originOverride ?? origin;
  const directory = await mkdtemp(join(tmpdir(), 'being-there-integrated-'));
  let now = Date.now();
  let repository = openFamilyRepository({ filename: join(directory, 'family.sqlite'), now: () => now });
  t.after(async () => { try { repository.close(); } catch {} await rm(directory, { recursive: true, force: true }); });
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const client = new OAuth2Client({ clientId, clientSecret: 'fictional-no-network-secret', redirectUri: appOrigin + '/auth/google/callback' });
  client.getFederatedSignonCertsAsync = async () => ({ certs: { fixture: publicKey.export({ type: 'spki', format: 'pem' }) } });
  let tokenPayload = null, challenge;
  client.getToken = async options => {
    if (options.code !== 'fixture-code' || options.redirect_uri !== appOrigin + '/auth/google/callback' || createHash('sha256').update(options.codeVerifier).digest('base64url') !== challenge) throw new Error('Bad fixture code/PKCE');
    const head = Buffer.from(JSON.stringify({ alg: 'RS256', kid: 'fixture' })).toString('base64url');
    const body = Buffer.from(JSON.stringify(tokenPayload)).toString('base64url');
    const signature = sign('RSA-SHA256', Buffer.from(head + '.' + body), privateKey).toString('base64url');
    return { tokens: { id_token: head + '.' + body + '.' + signature } };
  };
  let app = createApplication({ repository, appOrigin, googleClientId: clientId, googleClientSecret: 'fictional-no-network-secret', googleClient: client, driveClient, now: () => now });
  const request = (path, { cookie = '', method = 'GET', body, csrf, headers = {} } = {}) => app.handle(new Request(appOrigin + path, { method, headers: { cookie, ...(method !== 'GET' ? { origin: appOrigin, 'Content-Type': 'application/json', 'X-CSRF-Token': csrf ?? '' } : {}), ...headers }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) }));
  async function login(subject, email, overrides = {}) {
    const start = await request('/auth/google/start'); const location = new URL(start.headers.get('location')); challenge = location.searchParams.get('code_challenge');
    tokenPayload = { iss: 'https://accounts.google.com', aud: clientId, sub: subject, email, email_verified: true, hd: 'family.example.test', nonce: location.searchParams.get('nonce'), iat: Math.floor(now / 1000), auth_time: Math.floor(now / 1000), exp: Math.floor(now / 1000) + 3600, ...overrides };
    const browserCookie = start.headers.getSetCookie()[0].split(';')[0];
    const callbackPath = '/auth/google/callback?state=' + location.searchParams.get('state') + '&code=fixture-code';
    const callback = await request(callbackPath, { cookie: browserCookie });
    const cookies = callback.headers.getSetCookie().filter(value => !value.includes('Max-Age=0')).map(value => value.split(';')[0]);
    const cookie = cookies.join('; '), csrf = cookies.find(value => value.startsWith('__Host-being-there-csrf='))?.split('=')[1];
    return { cookie, csrf, callback, callbackPath, browserCookie, request: (path, options = {}) => request(path, { cookie, csrf, ...options }) };
  }
  return { get repository() { return repository; }, get app() { return app; }, directory, request, login,
    advance(ms) { now += ms; },
    reopen() { repository.close(); repository = openFamilyRepository({ filename: join(directory, 'family.sqlite'), now: () => now }); app = createApplication({ repository, appOrigin, googleClientId: clientId, googleClientSecret: 'fictional-no-network-secret', googleClient: client, driveClient, now: () => now }); }
  };
}
