import test from 'node:test';
import assert from 'node:assert/strict';
import { integratedFixture, origin } from './helpers/integrated-app-fixture.mjs';

const familyId = 'familyA';
const path = '/api/families/' + familyId + '/drive/verify';
const driveScope = 'https://www.googleapis.com/auth/drive.file';

async function household(t, { connected = true } = {}) {
  const calls = { refresh: 0, drive: 0 };
  let onRefresh = async () => {}, onDrive = async () => {};
  const f = await integratedFixture(t, {
    driveAccessToken: async refreshToken => {
      calls.refresh++;
      assert.equal(refreshToken, 'fixture-private-refresh');
      await onRefresh();
      return 'fixture-access-token';
    },
    driveFetch: async (url, options) => {
      calls.drive++;
      assert.equal(url, 'https://www.googleapis.com/drive/v3/about?fields=kind');
      assert.equal(options.method, 'GET');
      assert.equal(options.redirect, 'error');
      assert.equal(options.headers.Authorization, 'Bearer fixture-access-token');
      await onDrive();
      return new Response(JSON.stringify({ kind: 'drive#about' }), { status: 200 });
    }
  });
  const owner = await f.login('drive-probe-owner', 'owner@family.example.test');
  const bootstrap = f.repository.bootstrapInvitation({ familyId, label: 'Fictional family',
    email: 'owner@family.example.test' });
  assert.equal((await owner.request('/api/invitations/accept', { method: 'POST',
    body: { token: bootstrap.token } })).status, 200);
  const outsider = await f.login('drive-probe-outsider', 'outsider@family.example.test');
  const invite = async (email, role) => {
    const result = await owner.request('/api/families/familyA/invitations', { method: 'POST',
      body: { email, role } });
    assert.equal(result.status, 201);
    return (await result.json()).token;
  };
  const contributor = await f.login('drive-probe-contributor', 'contributor@family.example.test');
  assert.equal((await contributor.request('/api/invitations/accept', { method: 'POST',
    body: { token: await invite('contributor@family.example.test', 'contributor') } })).status, 200);
  const backup = await f.login('drive-probe-backup', 'backup@family.example.test');
  assert.equal((await backup.request('/api/invitations/accept', { method: 'POST',
    body: { token: await invite('backup@family.example.test', 'organizer') } })).status, 200);
  if (connected) {
    const principal = await f.app.sessions.authenticate(new Request(origin + path,
      { headers: { cookie: owner.cookie } }));
    f.repository.saveDriveConsent(principal, familyId, {
      refreshToken: 'fixture-private-refresh', scope: driveScope,
      subject: 'drive-probe-owner', consentedAt: Date.now(), generation: 0
    });
  }
  return { f, owner, outsider, contributor, backup, calls,
    onRefresh(fn) { onRefresh = fn; }, onDrive(fn) { onDrive = fn; } };
}
const assertZero = calls => assert.deepEqual(calls, { refresh: 0, drive: 0 });

test('only a recently authenticated organizer with separate consent can probe the real Drive API boundary', async t => {
  const { owner, calls } = await household(t);
  const result = await owner.request(path, { method: 'POST' });
  assert.equal(result.status, 200);
  assert.deepEqual(await result.json(), { verified: true });
  assert.equal(result.headers.get('cache-control'), 'private, no-store');
  assert.deepEqual(calls, { refresh: 1, drive: 1 });
});

test('anonymous, Google-signed-in outsider, contributor and wrong family cause ZERO token or Drive calls', async t => {
  const { f, owner, outsider, contributor, calls } = await household(t);
  assert.equal((await f.request(path, { method: 'POST' })).status, 401);
  assert.equal((await outsider.request(path, { method: 'POST' })).status, 404);
  assert.equal((await contributor.request(path, { method: 'POST' })).status, 404);
  assert.equal((await owner.request('/api/families/familyB/drive/verify', { method: 'POST' })).status, 404);
  assert.equal((await owner.request(path)).status, 404, 'no GET/token-refresh side effect');
  assertZero(calls);
});

test('invalid CSRF, origin, fetch site and stale authentication deny before token retrieval', async t => {
  const { f, owner, calls } = await household(t);
  assert.equal((await owner.request(path, { method: 'POST',
    headers: { 'x-csrf-token': 'invalid' } })).status, 403);
  assert.equal((await owner.request(path, { method: 'POST',
    headers: { origin: 'https://attacker.example.test' } })).status, 403);
  assert.equal((await owner.request(path, { method: 'POST',
    headers: { 'sec-fetch-site': 'cross-site' } })).status, 403);
  f.advance(300001);
  assert.equal((await owner.request(path, { method: 'POST' })).status, 403);
  assertZero(calls);
});

test('no separate Drive consent means Google login alone cannot refresh tokens or contact Drive', async t => {
  const { owner, calls } = await household(t, { connected: false });
  assert.equal((await owner.request(path, { method: 'POST' })).status, 404);
  assertZero(calls);
});

test('revoked organizer and disconnected consent deny before token retrieval', async t => {
  const { owner, backup, calls } = await household(t);
  assert.equal((await backup.request('/api/families/familyA/drive/disconnect',
    { method: 'POST' })).status, 200);
  assert.equal((await owner.request(path, { method: 'POST' })).status, 404);
  assertZero(calls);
  const id = (await (await owner.request('/api/session')).json()).accountId;
  assert.equal((await backup.request('/api/families/familyA/members/' + id + '/revoke',
    { method: 'POST', body: {} })).status, 200);
  assert.equal((await owner.request(path, { method: 'POST' })).status, 404);
  assertZero(calls);
});

test('membership revocation during refresh blocks the Drive API call', async t => {
  const { owner, backup, calls, onRefresh } = await household(t);
  const id = (await (await owner.request('/api/session')).json()).accountId;
  onRefresh(async () => {
    assert.equal((await backup.request('/api/families/familyA/members/' + id + '/revoke',
      { method: 'POST', body: {} })).status, 200);
  });
  assert.equal((await owner.request(path, { method: 'POST' })).status, 404);
  assert.deepEqual(calls, { refresh: 1, drive: 0 });
});

test('Drive disconnect during refresh blocks the Drive API call', async t => {
  const { owner, backup, calls, onRefresh } = await household(t);
  onRefresh(async () => {
    assert.equal((await backup.request('/api/families/familyA/drive/disconnect',
      { method: 'POST' })).status, 200);
  });
  assert.equal((await owner.request(path, { method: 'POST' })).status, 404);
  assert.deepEqual(calls, { refresh: 1, drive: 0 });
});

test('revocation during the Drive API call cannot return a successful probe', async t => {
  const { owner, backup, calls, onDrive } = await household(t);
  const id = (await (await owner.request('/api/session')).json()).accountId;
  onDrive(async () => {
    assert.equal((await backup.request('/api/families/familyA/members/' + id + '/revoke',
      { method: 'POST', body: {} })).status, 200);
  });
  const response = await owner.request(path, { method: 'POST' });
  assert.equal(response.status, 404);
  assert.deepEqual(calls, { refresh: 1, drive: 1 },
    'already-started provider calls cannot be undone; no content is returned');
});
