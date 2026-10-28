import test from 'node:test';
import assert from 'node:assert/strict';
import { integratedFixture, origin } from './helpers/integrated-app-fixture.mjs';

const path = '/api/families/familyA/drive/folder';
const scope = 'https://www.googleapis.com/auth/drive.file';
const mime = 'application/vnd.google-apps.folder';
const folderId = 'private_drive_folder_123456';

async function household(t, { connected = true } = {}) {
  const calls = { refresh: 0, drive: 0 };
  let onRefresh = async () => {}, onDrive = async () => {};
  const f = await integratedFixture(t, {
    driveAccessToken: async token => {
      calls.refresh++;
      assert.equal(token, 'private-fixture-refresh');
      await onRefresh();
      return 'private-fixture-access';
    },
    driveFetch: async (url, options) => {
      calls.drive++;
      assert.equal(url, 'https://www.googleapis.com/drive/v3/files?fields=id,name,mimeType');
      assert.equal(options.method, 'POST');
      assert.equal(options.redirect, 'error');
      assert.equal(options.headers.Authorization, 'Bearer private-fixture-access');
      assert.deepEqual(JSON.parse(options.body), { name: 'Being There Archive', mimeType: mime });
      assert.equal(options.body.includes('familyA'), false);
      assert.equal(options.body.includes('permissions'), false);
      await onDrive();
      return new Response(JSON.stringify({ id: folderId, name: 'Being There Archive', mimeType: mime }),
        { status: 201 });
    }
  });
  const owner = await f.login('drive-folder-owner', 'owner@family.example.test');
  const bootstrap = f.repository.bootstrapInvitation({ familyId: 'familyA', label: 'Fictional family',
    email: 'owner@family.example.test' });
  assert.equal((await owner.request('/api/invitations/accept',
    { method: 'POST', body: { token: bootstrap.token } })).status, 200);
  const outsider = await f.login('drive-folder-outsider', 'outsider@family.example.test');
  const invite = async (email, role) => {
    const result = await owner.request('/api/families/familyA/invitations',
      { method: 'POST', body: { email, role } });
    assert.equal(result.status, 201);
    return (await result.json()).token;
  };
  const contributor = await f.login('drive-folder-contributor', 'contributor@family.example.test');
  assert.equal((await contributor.request('/api/invitations/accept',
    { method: 'POST', body: { token: await invite('contributor@family.example.test', 'contributor') } })).status, 200);
  const backup = await f.login('drive-folder-backup', 'backup@family.example.test');
  assert.equal((await backup.request('/api/invitations/accept',
    { method: 'POST', body: { token: await invite('backup@family.example.test', 'organizer') } })).status, 200);
  if (connected) {
    const principal = await f.app.sessions.authenticate(new Request(origin + path,
      { headers: { cookie: owner.cookie } }));
    f.repository.saveDriveConsent(principal, 'familyA', { refreshToken: 'private-fixture-refresh',
      scope, subject: 'drive-folder-owner', consentedAt: Date.now() - 10000, generation: 0 });
  }
  return { f, owner, outsider, contributor, backup, calls,
    onRefresh(fn) { onRefresh = fn; }, onDrive(fn) { onDrive = fn; } };
}

test('organizer creates a private folder once and durable retries do not call Drive', async t => {
  const { f, owner, calls } = await household(t);
  const created = await owner.request(path, { method: 'POST' });
  assert.equal(created.status, 201);
  assert.deepEqual(await created.json(), { folderId, created: true });
  assert.deepEqual(calls, { refresh: 1, drive: 1 });
  f.reopen();
  const repeat = await owner.request(path, { method: 'POST' });
  assert.equal(repeat.status, 200);
  assert.deepEqual(await repeat.json(), { folderId, created: false });
  assert.deepEqual(calls, { refresh: 1, drive: 1 });
});

test('anonymous, uninvited, wrong family, contributor, GET and HEAD make zero token/Drive calls', async t => {
  const { f, owner, outsider, contributor, calls } = await household(t);
  for (const response of [
    await f.request(path, { method: 'POST' }),
    await outsider.request(path, { method: 'POST' }),
    await contributor.request(path, { method: 'POST' }),
    await owner.request('/api/families/familyB/drive/folder', { method: 'POST' }),
    await owner.request(path), await owner.request(path, { method: 'HEAD' }),
    await owner.request(path + '?unexpected=1', { method: 'POST' })
  ]) {
    assert.ok([401, 404].includes(response.status));
    assert.equal(response.headers.get('location'), null);
    assert.equal((await response.text()).includes(folderId), false);
  }
  assert.deepEqual(calls, { refresh: 0, drive: 0 });
});

test('CSRF, Origin, cross-site and stale authentication fail before token access', async t => {
  const { f, owner, calls } = await household(t);
  for (const headers of [{ 'x-csrf-token': 'invalid' },
    { origin: 'https://attacker.example.test' }, { 'sec-fetch-site': 'cross-site' }]) {
    assert.equal((await owner.request(path, { method: 'POST', headers })).status, 403);
  }
  f.advance(300001);
  assert.equal((await owner.request(path, { method: 'POST' })).status, 403);
  assert.deepEqual(calls, { refresh: 0, drive: 0 });
});

test('Google login without separately granted Drive consent cannot create a folder', async t => {
  const { owner, calls } = await household(t, { connected: false });
  assert.equal((await owner.request(path, { method: 'POST' })).status, 404);
  assert.deepEqual(calls, { refresh: 0, drive: 0 });
});

test('disconnect during refresh prevents Drive API call and folder reservation', async t => {
  const { owner, backup, calls, onRefresh } = await household(t);
  onRefresh(async () => {
    assert.equal((await backup.request('/api/families/familyA/drive/disconnect',
      { method: 'POST' })).status, 200);
  });
  assert.equal((await owner.request(path, { method: 'POST' })).status, 404);
  assert.deepEqual(calls, { refresh: 1, drive: 0 });
});

test('revocation during provider call denies result and leaves a safe pending reservation', async t => {
  const { owner, backup, calls, onDrive } = await household(t);
  onDrive(async () => {
    const id = (await (await owner.request('/api/session')).json()).accountId;
    assert.equal((await backup.request('/api/families/familyA/members/' + id + '/revoke',
      { method: 'POST', body: {} })).status, 200);
  });
  const denied = await owner.request(path, { method: 'POST' });
  assert.equal(denied.status, 404);
  assert.equal((await denied.text()).includes(folderId), false);
  assert.deepEqual(calls, { refresh: 1, drive: 1 });
  // An in-flight Drive creation cannot be rolled back. The pending reservation
  // blocks blind retries and duplicate folders until an operator reconciles it.
  const retry = await backup.request(path, { method: 'POST' });
  assert.equal(retry.status, 404, 'different Google subject has no Drive consent');
  assert.deepEqual(calls, { refresh: 1, drive: 1 });
});

test('two simultaneous folder requests cannot create duplicate Drive folders', async t => {
  const { owner, calls, onDrive } = await household(t);
  let entered, release;
  const started = new Promise(resolve => { entered = resolve; });
  const held = new Promise(resolve => { release = resolve; });
  onDrive(async () => { entered(); await held; });
  const first = owner.request(path, { method: 'POST' });
  await started; // The first request has reserved the folder and entered Drive.
  const second = await owner.request(path, { method: 'POST' });
  assert.equal(second.status, 409);
  release();
  assert.equal((await first).status, 201);
  assert.deepEqual(calls, { refresh: 1, drive: 1 });
});
