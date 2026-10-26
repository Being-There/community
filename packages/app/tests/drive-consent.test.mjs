import test from 'node:test';
import assert from 'node:assert/strict';
import { integratedFixture, origin, clientId } from './helpers/integrated-app-fixture.mjs';

const family = 'familyA';
const driveScope = 'https://www.googleapis.com/auth/drive.file';
const path = action => '/api/families/' + family + '/drive/' + action;
const parse = async response => response.json();
function mockDrive() {
  const counters = { authUrls: 0, tokenExchanges: 0, verifications: 0 };
  let payload = {}, onExchange = async () => {}, scopes = 'openid email ' + driveScope;
  const client = {
    async generateCodeVerifierAsync() { return { codeVerifier: 'v'.repeat(43), codeChallenge: 'c'.repeat(43) }; },
    generateAuthUrl(args) {
      counters.authUrls++;
      assert.equal(args.access_type, 'offline');
      assert.equal(args.prompt, 'consent select_account');
      assert.deepEqual(args.scope, ['openid', 'email', driveScope]);
      assert.equal(args.code_challenge_method, 'S256');
      return 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({
        state: args.state, nonce: args.nonce, scope: args.scope.join(' ')
      });
    },
    async getToken(args) {
      counters.tokenExchanges++;
      assert.equal(args.codeVerifier, 'v'.repeat(43));
      assert.equal(args.redirect_uri, origin + '/auth/drive/callback');
      await onExchange();
      return { tokens: { id_token: 'synthetic-consent-id', refresh_token: 'synthetic-private-refresh', scope: scopes } };
    },
    async verifyIdToken({ audience }) {
      counters.verifications++;
      assert.equal(audience, clientId);
      return { getPayload: () => payload };
    }
  };
  return { client, counters, setPayload(value) { payload = value; }, setSubject(subject) { payload = { ...payload, sub: subject }; },
    onExchange(fn) { onExchange = fn; }, setScopes(value) { scopes = value; } };
}
async function household(t) {
  const drive = mockDrive();
  const f = await integratedFixture(t, { driveClient: drive.client });
  const owner = await f.login('drive-owner', 'owner@family.example.test');
  const bootstrap = f.repository.bootstrapInvitation({ familyId: family, label: 'Synthetic family', email: 'owner@family.example.test' });
  assert.equal((await owner.request('/api/invitations/accept', { method: 'POST', body: { token: bootstrap.token } })).status, 200);
  const outsider = await f.login('drive-outsider', 'outsider@family.example.test');
  const invite = async (email, role) => {
    const response = await owner.request('/api/families/familyA/invitations', { method: 'POST', body: { email, role } });
    assert.equal(response.status, 201);
    return (await parse(response)).token;
  };
  const contributor = await f.login('drive-contributor', 'contributor@family.example.test');
  assert.equal((await contributor.request('/api/invitations/accept', { method: 'POST',
    body: { token: await invite('contributor@family.example.test', 'contributor') } })).status, 200);
  const backup = await f.login('drive-backup', 'backup@family.example.test');
  assert.equal((await backup.request('/api/invitations/accept', { method: 'POST',
    body: { token: await invite('backup@family.example.test', 'organizer') } })).status, 200);
  return { f, drive, owner, outsider, contributor, backup };
}
async function start(owner, drive) {
  const response = await owner.request(path('start'), { method: 'POST' });
  assert.equal(response.status, 303);
  const url = new URL(response.headers.get('location'));
  assert.equal(url.origin, 'https://accounts.google.com');
  const now = Math.floor(Date.now() / 1000);
  drive.setPayload({ iss: 'https://accounts.google.com', aud: clientId, sub: 'drive-owner',
    nonce: url.searchParams.get('nonce'), iat: now, exp: now + 3600 });
  return '/auth/drive/callback?state=' + url.searchParams.get('state') + '&code=synthetic-code';
}

test('separate organizer consent stores only private refresh token and supports disconnect/reconsent', async t => {
  const { f, drive, owner } = await household(t);
  assert.deepEqual(await parse(await owner.request(path('status'))), { connected: false });
  const callback = await start(owner, drive);
  assert.equal(drive.counters.tokenExchanges, 0, 'login must not grant Drive consent');
  const accepted = await owner.request(callback);
  assert.equal(accepted.status, 303);
  assert.equal(accepted.headers.get('location'), '/?drive=connected');
  const status = await parse(await owner.request(path('status')));
  assert.equal(status.connected, true);
  assert.equal(status.scope, driveScope);
  assert.ok(Number.isSafeInteger(status.consentedAt));
  assert.doesNotMatch(JSON.stringify(status), /synthetic-private-refresh/);
  assert.equal((await owner.request(callback)).status, 404, 'OAuth callback must be single use');
  assert.equal(drive.counters.tokenExchanges, 1);
  assert.equal((await owner.request(path('disconnect'), { method: 'POST' })).status, 200);
  assert.deepEqual(await parse(await owner.request(path('status'))), { connected: false });
  assert.equal((await owner.request(await start(owner, drive))).status, 303, 'explicit reconsent must work');
  assert.equal((await parse(await owner.request(path('status')))).connected, true);
  assert.equal(drive.counters.tokenExchanges, 2);
  f.reopen();
  assert.equal((await parse(await owner.request(path('status')))).connected, true, 'private consent must survive host restart');
});

test('anonymous, outsider, cross-family, contributor and invalid CSRF/Origin never start Drive OAuth or load tokens', async t => {
  const { f, drive, owner, outsider, contributor } = await household(t);
  assert.equal((await f.request(path('status'))).status, 401);
  assert.equal((await f.request(path('start'), { method: 'POST' })).status, 401);
  for (const user of [outsider, contributor]) {
    assert.equal((await user.request(path('status'))).status, 404);
    assert.equal((await user.request(path('start'), { method: 'POST' })).status, 404);
    assert.equal((await user.request(path('disconnect'), { method: 'POST' })).status, 404);
  }
  assert.equal((await owner.request('/api/families/familyB/drive/start', { method: 'POST' })).status, 404);
  assert.equal((await owner.request(path('start'), { method: 'POST', headers: { 'x-csrf-token': 'invalid' } })).status, 403);
  assert.equal((await owner.request(path('start'), { method: 'POST', headers: { origin: 'https://evil.example.test' } })).status, 403);
  assert.equal((await owner.request(path('disconnect'), { method: 'POST', headers: { 'sec-fetch-site': 'cross-site' } })).status, 403);
  assert.equal((await f.request('/auth/drive/callback?state=' + 'x'.repeat(43) + '&code=stolen')).status, 404);
  assert.deepEqual(drive.counters, { authUrls: 0, tokenExchanges: 0, verifications: 0 });
});

test('browser-bound state, revocation and expiry deny callback before token exchange', async t => {
  const { f, drive, owner, outsider, backup } = await household(t);
  const callback = await start(owner, drive);
  assert.equal((await outsider.request(callback)).status, 404);
  assert.equal((await owner.request(callback.replace('synthetic-code', 'synthetic-code&state=duplicate'))).status, 404);
  assert.equal(drive.counters.tokenExchanges, 0);
  const ownerId = (await parse(await owner.request('/api/session'))).accountId;
  assert.equal((await backup.request('/api/families/familyA/members/' + ownerId + '/revoke',
    { method: 'POST', body: {} })).status, 200);
  assert.equal((await owner.request(callback)).status, 404);
  assert.equal(drive.counters.tokenExchanges, 0);
  assert.deepEqual(await parse(await backup.request(path('status'))), { connected: false });
});

test('revocation during consent exchange and overbroad scope never persist credentials', async t => {
  const { f, drive, owner, backup } = await household(t);
  const callback = await start(owner, drive);
  const ownerId = (await parse(await owner.request('/api/session'))).accountId;
  drive.onExchange(async () => {
    assert.equal((await backup.request('/api/families/familyA/members/' + ownerId + '/revoke',
      { method: 'POST', body: {} })).status, 200);
  });
  assert.equal((await owner.request(callback)).status, 404);
  assert.equal(drive.counters.tokenExchanges, 1, 'exchange started while owner was authorized');
  assert.deepEqual(await parse(await backup.request(path('status'))), { connected: false });
});

test('overbroad scopes and wrong Google account fail without storing consent', async t => {
  const { drive, owner } = await household(t);
  const first = await start(owner, drive);
  drive.setScopes('openid email ' + driveScope + ' https://www.googleapis.com/auth/drive');
  assert.equal((await owner.request(first)).status, 401);
  assert.equal((await parse(await owner.request(path('status')))).connected, false);
  drive.setScopes('openid email ' + driveScope);
  const second = await start(owner, drive);
  drive.setSubject('different-google-account');
  assert.equal((await owner.request(second)).status, 401);
  assert.equal((await parse(await owner.request(path('status')))).connected, false);
});
