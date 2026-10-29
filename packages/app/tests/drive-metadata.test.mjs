import test from 'node:test';
import assert from 'node:assert/strict';
import { integratedFixture, origin } from './helpers/integrated-app-fixture.mjs';
import { validateArchiveContent } from '../src/core/family-archive.mjs';

const path = '/api/families/familyA/drive/metadata';
const folderPath = '/api/families/familyA/drive/folder';
const scope = 'https://www.googleapis.com/auth/drive.file';
const folderId = 'private_drive_folder_123456';
const fileId = 'private_metadata_file_123456';

async function household(t, { consent = true, folder = true } = {}) {
  const calls = { refresh: 0, upload: 0, folder: 0 };
  let onRefresh = async () => {}, onUpload = async () => {};
  let lastSnapshot, lastMetadata;
  const f = await integratedFixture(t, {
    driveAccessToken: async token => {
      calls.refresh++;
      assert.equal(token, 'private-fixture-refresh');
      await onRefresh();
      return 'private-fixture-access';
    },
    driveFetch: async (url, options) => {
      assert.equal(options.method, 'POST');
      assert.equal(options.headers.Authorization, 'Bearer private-fixture-access');
      assert.equal(options.redirect, 'error');
      if (url === 'https://www.googleapis.com/drive/v3/files?fields=id,name,mimeType') {
        calls.folder++;
        assert.deepEqual(JSON.parse(options.body), {
          name: 'Being There Archive', mimeType: 'application/vnd.google-apps.folder'
        });
        return new Response(JSON.stringify({ id: folderId, name: 'Being There Archive',
          mimeType: 'application/vnd.google-apps.folder' }), { status: 201 });
      }
      assert.equal(url, 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,parents');
      calls.upload++;
      assert.match(options.headers['Content-Type'], /^multipart\/related; boundary=bt_[a-f0-9]{32}$/);
      const raw = options.body.toString('utf8');
      const parts = raw.split('\r\n\r\n');
      assert.equal(parts.length, 3);
      lastMetadata = JSON.parse(parts[1].split('\r\n--bt_')[0]);
      lastSnapshot = JSON.parse(parts[2].split('\r\n--bt_')[0]);
      assert.deepEqual(lastMetadata.parents, [folderId]);
      assert.equal(lastMetadata.mimeType, 'application/json');
      assert.equal(lastSnapshot.format, 'being-there.drive-metadata');
      assert.equal(lastSnapshot.version, 1);
      assert.equal(lastSnapshot.content.family.id, 'familyA');
      assert.deepEqual(validateArchiveContent(lastSnapshot.content, 'familyA'), lastSnapshot.content);
      assert.ok(!raw.includes('private-fixture-refresh'));
      assert.ok(!raw.includes('owner@family.example.test'));
      assert.ok(!raw.includes('"sessions"'));
      assert.ok(!raw.includes('"invitations"'));
      assert.ok(!raw.includes('"memberships"'));
      assert.ok(!raw.includes('"bytes"'));
      await onUpload();
      return new Response(JSON.stringify({ id: fileId, name: lastMetadata.name,
        mimeType: 'application/json', parents: [folderId] }), { status: 201 });
    }
  });
  const owner = await f.login('drive-metadata-owner', 'owner@family.example.test');
  const bootstrap = f.repository.bootstrapInvitation({ familyId: 'familyA',
    label: 'Fictional family', email: 'owner@family.example.test' });
  assert.equal((await owner.request('/api/invitations/accept',
    { method: 'POST', body: { token: bootstrap.token } })).status, 200);
  const outsider = await f.login('drive-metadata-outsider', 'outsider@family.example.test');
  const invite = async (email, role) => {
    const response = await owner.request('/api/families/familyA/invitations',
      { method: 'POST', body: { email, role } });
    assert.equal(response.status, 201);
    return (await response.json()).token;
  };
  const contributor = await f.login('drive-metadata-contributor', 'contributor@family.example.test');
  assert.equal((await contributor.request('/api/invitations/accept',
    { method: 'POST', body: { token: await invite('contributor@family.example.test', 'contributor') } })).status, 200);
  const backup = await f.login('drive-metadata-backup', 'backup@family.example.test');
  assert.equal((await backup.request('/api/invitations/accept',
    { method: 'POST', body: { token: await invite('backup@family.example.test', 'organizer') } })).status, 200);
  if (consent) {
    const principal = await f.app.sessions.authenticate(new Request(origin + path,
      { headers: { cookie: owner.cookie } }));
    f.repository.saveDriveConsent(principal, 'familyA', {
      refreshToken: 'private-fixture-refresh', scope, subject: 'drive-metadata-owner',
      consentedAt: Date.now() - 10000, generation: 0
    });
  }
  if (folder) {
    assert.equal((await owner.request(folderPath, { method: 'POST' })).status, 201);
    calls.refresh = 0; calls.folder = 0;
  }
  return { f, owner, outsider, contributor, backup, calls,
    onRefresh(fn) { onRefresh = fn; }, onUpload(fn) { onUpload = fn; },
    get snapshot() { return lastSnapshot; }, get metadata() { return lastMetadata; } };
}

test('private Drive metadata snapshot is readable, immutable and idempotent across reopen', async t => {
  const h = await household(t);
  const created = await h.owner.request(path, { method: 'POST' });
  assert.equal(created.status, 201);
  const body = await created.json();
  assert.equal(body.fileId, fileId);
  assert.match(body.sha256, /^[a-f0-9]{64}$/);
  assert.equal(body.created, true);
  assert.equal(h.metadata.name, 'being-there-metadata-' + body.sha256 + '.json');
  assert.deepEqual(h.calls, { refresh: 1, upload: 1, folder: 0 });
  h.f.reopen();
  const again = await h.owner.request(path, { method: 'POST' });
  assert.equal(again.status, 200);
  assert.deepEqual(await again.json(), { fileId, sha256: body.sha256, created: false });
  assert.deepEqual(h.calls, { refresh: 1, upload: 1, folder: 0 });
});

test('uninvited, anonymous, contributor, cross-family, GET/HEAD make zero token and Drive calls', async t => {
  const h = await household(t);
  const responses = [
    await h.f.request(path, { method: 'POST' }),
    await h.outsider.request(path, { method: 'POST' }),
    await h.contributor.request(path, { method: 'POST' }),
    await h.owner.request('/api/families/familyB/drive/metadata', { method: 'POST' }),
    await h.owner.request(path), await h.owner.request(path, { method: 'HEAD' }),
    await h.owner.request(path + '?list=1', { method: 'POST' })
  ];
  for (const response of responses) {
    assert.ok([401, 404].includes(response.status));
    assert.equal((await response.text()).includes(fileId), false);
  }
  assert.deepEqual(h.calls, { refresh: 0, upload: 0, folder: 0 });
});

test('CSRF, Origin, stale session and revoked invitation deny before any provider call', async t => {
  const h = await household(t);
  for (const headers of [{ 'x-csrf-token': 'wrong' },
    { origin: 'https://attacker.example.test' }, { 'sec-fetch-site': 'cross-site' }])
    assert.equal((await h.owner.request(path, { method: 'POST', headers })).status, 403);
  h.f.advance(300001);
  assert.equal((await h.owner.request(path, { method: 'POST' })).status, 403);
  assert.deepEqual(h.calls, { refresh: 0, upload: 0, folder: 0 });
});

test('Drive consent and a ready private folder are required before token access', async t => {
  const a = await household(t, { consent: false, folder: false });
  assert.equal((await a.owner.request(path, { method: 'POST' })).status, 404);
  assert.deepEqual(a.calls, { refresh: 0, upload: 0, folder: 0 });
});
test('missing private Drive folder denies before token access', async t => {
  const h = await household(t, { folder: false });
  assert.equal((await h.owner.request(path, { method: 'POST' })).status, 404);
  assert.deepEqual(h.calls, { refresh: 0, upload: 0, folder: 0 });
});

test('disconnect during token refresh prevents any Drive upload', async t => {
  const h = await household(t);
  h.onRefresh(async () => {
    assert.equal((await h.backup.request('/api/families/familyA/drive/disconnect',
      { method: 'POST' })).status, 200);
  });
  assert.equal((await h.owner.request(path, { method: 'POST' })).status, 404);
  assert.deepEqual(h.calls, { refresh: 1, upload: 0, folder: 0 });
});

test('revocation during upload suppresses success and leaves safe pending claim', async t => {
  const h = await household(t);
  h.onUpload(async () => {
    const accountId = (await (await h.owner.request('/api/session')).json()).accountId;
    assert.equal((await h.backup.request('/api/families/familyA/members/' + accountId + '/revoke',
      { method: 'POST', body: {} })).status, 200);
  });
  const denied = await h.owner.request(path, { method: 'POST' });
  assert.equal(denied.status, 404);
  assert.equal((await denied.text()).includes(fileId), false);
  assert.deepEqual(h.calls, { refresh: 1, upload: 1, folder: 0 });
});

test('simultaneous identical metadata writes create at most one Drive file', async t => {
  const h = await household(t);
  let entered, release;
  const started = new Promise(resolve => { entered = resolve; });
  const held = new Promise(resolve => { release = resolve; });
  h.onUpload(async () => { entered(); await held; });
  const first = h.owner.request(path, { method: 'POST' });
  await started;
  const second = await h.owner.request(path, { method: 'POST' });
  assert.equal(second.status, 409);
  release();
  assert.equal((await first).status, 201);
  assert.deepEqual(h.calls, { refresh: 1, upload: 1, folder: 0 });
});
