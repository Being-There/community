import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, webcrypto } from 'node:crypto';
import sharp from 'sharp';
import { integratedFixture, origin } from './helpers/integrated-app-fixture.mjs';
import { createFamilyArchive, prepareFamilyRestore } from '../src/core/family-archive.mjs';

const prefix = '/api/families/familyA/drive/originals/';
const scope = 'https://www.googleapis.com/auth/drive.file';
const folderId = 'private_drive_folder_123456';
const fileId = 'private_original_file_123456';
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const md5 = bytes => createHash('md5').update(bytes).digest('hex');

function multipart(options) {
  const boundary = options.headers['Content-Type'].split('boundary=')[1];
  assert.match(boundary, /^bt_[a-f0-9]{32}$/);
  const raw = options.body;
  const first = raw.indexOf(Buffer.from('\r\n\r\n')) + 4;
  const second = raw.indexOf(Buffer.from('\r\n--' + boundary + '\r\n'), first);
  const third = raw.indexOf(Buffer.from('\r\n\r\n'), second) + 4;
  const end = raw.indexOf(Buffer.from('\r\n--' + boundary + '--\r\n'), third);
  assert.ok(first > 3 && second > first && third > second && end >= third);
  return { metadata: JSON.parse(raw.subarray(first, second).toString('utf8')),
    bytes: Buffer.from(raw.subarray(third, end)) };
}

async function household(t, { consent = true, folder = true } = {}) {
  const calls = { refresh: 0, upload: 0, folder: 0, metadata: 0 };
  const uploaded = new Map();
  let onRefresh = async () => {}, onUpload = async () => {}, corruptResponse = false;
  let metadataContent;
  const f = await integratedFixture(t, {
    driveAccessToken: async token => {
      calls.refresh++;
      assert.equal(token, 'fixture-refresh-token');
      await onRefresh();
      return 'fixture-access-token';
    },
    driveFetch: async (url, options) => {
      assert.equal(options.method, 'POST');
      assert.equal(options.redirect, 'error');
      assert.equal(options.headers.Authorization, 'Bearer fixture-access-token');
      if (url === 'https://www.googleapis.com/drive/v3/files?fields=id,name,mimeType') {
        calls.folder++;
        return new Response(JSON.stringify({ id: folderId, name: 'Being There Archive',
          mimeType: 'application/vnd.google-apps.folder' }), { status: 201 });
      }
      const { metadata, bytes } = multipart(options);
      assert.deepEqual(metadata.parents, [folderId]);
      assert.equal(metadata.permissions, undefined);
      assert.ok(!options.body.toString('utf8').includes('fixture-refresh-token'));
      if (metadata.mimeType === 'application/json') {
        calls.metadata++;
        metadataContent = JSON.parse(bytes.toString('utf8'));
        return new Response(JSON.stringify({ id: 'private_metadata_file_123456', ...metadata }), { status: 201 });
      }
      assert.equal(url, 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,parents,size,md5Checksum');
      calls.upload++;
      assert.match(metadata.name, /^being-there-original-[A-Za-z0-9_-]+-[a-f0-9]{64}\.(png|jpg|webp|wav|webm|mp4|bin)$/);
      uploaded.set(metadata.name, { metadata, bytes });
      await onUpload();
      return new Response(JSON.stringify({ id: fileId, ...metadata, size: String(bytes.length),
        md5Checksum: corruptResponse ? '0'.repeat(32) : md5(bytes) }), { status: 201 });
    }
  });
  const owner = await f.login('drive-original-owner', 'owner@family.example.test');
  const bootstrap = f.repository.bootstrapInvitation({ familyId: 'familyA',
    label: 'Fictional household', email: 'owner@family.example.test' });
  assert.equal((await owner.request('/api/invitations/accept',
    { method: 'POST', body: { token: bootstrap.token } })).status, 200);
  const outsider = await f.login('drive-original-outsider', 'outsider@family.example.test');
  const contributor = await f.login('drive-original-contributor', 'contributor@family.example.test');
  const backup = await f.login('drive-original-backup', 'backup@family.example.test');
  for (const [client, email, role] of [
    [contributor, 'contributor@family.example.test', 'contributor'],
    [backup, 'backup@family.example.test', 'organizer']
  ]) {
    const invitation = await owner.request('/api/families/familyA/invitations',
      { method: 'POST', body: { email, role } });
    assert.equal(invitation.status, 201);
    const { token } = await invitation.json();
    assert.equal((await client.request('/api/invitations/accept',
      { method: 'POST', body: { token } })).status, 200);
  }
  assert.equal((await owner.request('/api/families/familyA/people',
    { method: 'POST', body: { id: 'fictional-person', displayName: 'Fictional person' } })).status, 201);
  const photo = await sharp({ create: { width: 16, height: 12, channels: 3,
    background: '#669966' } }).png().toBuffer();
  const saved = await owner.request('/api/families/familyA/contributions', { method: 'POST',
    body: { id: 'photo1', title: 'Fictional garden', personIds: ['fictional-person'],
      base64: photo.toString('base64') } });
  assert.equal(saved.status, 200);
  const { originalId } = await saved.json();
  if (consent) {
    const principal = await f.app.sessions.authenticate(new Request(origin + prefix + originalId,
      { headers: { cookie: owner.cookie } }));
    f.repository.saveDriveConsent(principal, 'familyA', {
      refreshToken: 'fixture-refresh-token', scope, subject: 'drive-original-owner',
      consentedAt: Date.now() - 10000, generation: 0
    });
  }
  if (folder) {
    assert.equal((await owner.request('/api/families/familyA/drive/folder', { method: 'POST' })).status, 201);
    calls.refresh = 0; calls.folder = 0;
  }
  return { f, owner, outsider, contributor, backup, originalId, photo, calls, uploaded,
    get metadataContent() { return metadataContent; },
    onRefresh(fn) { onRefresh = fn; }, onUpload(fn) { onUpload = fn; },
    corrupt() { corruptResponse = true; } };
}

test('exact original bytes and readable metadata independently restore, without identity grants', async t => {
  const h = await household(t);
  const response = await h.owner.request(prefix + h.originalId, { method: 'POST' });
  assert.equal(response.status, 201);
  const created = await response.json();
  assert.equal(created.fileId, fileId);
  assert.equal(created.originalId, h.originalId);
  assert.equal(created.sha256, hash(h.photo));
  assert.equal(created.created, true);
  assert.equal(h.uploaded.size, 1);
  const [name, saved] = [...h.uploaded][0];
  assert.equal(name, 'being-there-original-' + h.originalId + '-' + hash(h.photo) + '.png');
  assert.equal(saved.metadata.mimeType, 'image/png');
  assert.deepEqual(saved.bytes, h.photo);
  assert.deepEqual(h.calls, { refresh: 1, upload: 1, folder: 0, metadata: 0 });

  const metadata = await h.owner.request('/api/families/familyA/drive/metadata', { method: 'POST' });
  assert.equal(metadata.status, 201);
  const content = h.metadataContent.content;
  assert.equal(h.metadataContent.format, 'being-there.drive-metadata');
  assert.equal(content.originals.length, 1);
  const files = await createFamilyArchive({ content, expectedFamilyId: 'familyA',
    subtleCrypto: webcrypto.subtle, store: { get: async key => {
      assert.equal(key, 'families/familyA/originals/' + h.originalId);
      return saved.bytes;
    } } });
  const restored = await prepareFamilyRestore({ files, expectedFamilyId: 'familyA',
    targetFamilyId: 'freshFamily', subtleCrypto: webcrypto.subtle });
  assert.equal(h.f.repository.commitIsolatedRestore(restored).access, 'disabled');
  assert.deepEqual(Buffer.from(h.f.repository.getMediaBytes('freshFamily', h.originalId)), h.photo);
  assert.equal(h.f.repository.listMembers('freshFamily').length, 0);

  h.f.reopen();
  const again = await h.owner.request(prefix + h.originalId, { method: 'POST' });
  assert.equal(again.status, 200);
  assert.deepEqual(await again.json(), { fileId, originalId: h.originalId,
    sha256: hash(h.photo), created: false });
  assert.deepEqual(h.calls, { refresh: 2, upload: 1, folder: 0, metadata: 1 });
});

test('anonymous, signed-in outsider, wrong family, contributor, derivative, GET/HEAD deny without tokens', async t => {
  const h = await household(t);
  for (const response of [
    await h.f.request(prefix + h.originalId, { method: 'POST' }),
    await h.outsider.request(prefix + h.originalId, { method: 'POST' }),
    await h.contributor.request(prefix + h.originalId, { method: 'POST' }),
    await h.owner.request('/api/families/foreign/drive/originals/' + h.originalId, { method: 'POST' }),
    await h.owner.request(prefix + h.originalId + '_small', { method: 'POST' }),
    await h.owner.request(prefix + 'not_an_original', { method: 'POST' }),
    await h.owner.request(prefix + h.originalId),
    await h.owner.request(prefix + h.originalId, { method: 'HEAD' }),
    await h.owner.request(prefix + h.originalId + '?list=1', { method: 'POST' })
  ]) {
    assert.ok([401, 404].includes(response.status), 'denied: ' + response.status);
    assert.equal((await response.text()).includes(fileId), false);
  }
  assert.deepEqual(h.calls, { refresh: 0, upload: 0, folder: 0, metadata: 0 });
});

test('a previously authorized organizer revoked before upload cannot reach token or Drive', async t => {
  const h = await household(t);
  const ownerId = (await (await h.owner.request('/api/session')).json()).accountId;
  assert.equal((await h.backup.request('/api/families/familyA/members/' + ownerId + '/revoke',
    { method: 'POST', body: {} })).status, 200);
  assert.equal((await h.owner.request(prefix + h.originalId, { method: 'POST' })).status, 404);
  assert.deepEqual(h.calls, { refresh: 0, upload: 0, folder: 0, metadata: 0 });
});

test('bad CSRF, Origin, cross-site and stale authentication deny before token access', async t => {
  const h = await household(t);
  for (const headers of [{ 'x-csrf-token': 'wrong' },
    { origin: 'https://attacker.example.test' }, { 'sec-fetch-site': 'cross-site' }])
    assert.equal((await h.owner.request(prefix + h.originalId, { method: 'POST', headers })).status, 403);
  h.f.advance(300001);
  assert.equal((await h.owner.request(prefix + h.originalId, { method: 'POST' })).status, 403);
  assert.deepEqual(h.calls, { refresh: 0, upload: 0, folder: 0, metadata: 0 });
});

test('separate Drive consent and private folder are mandatory', async t => {
  const a = await household(t, { consent: false, folder: false });
  assert.equal((await a.owner.request(prefix + a.originalId, { method: 'POST' })).status, 404);
  assert.deepEqual(a.calls, { refresh: 0, upload: 0, folder: 0, metadata: 0 });
});
test('missing private folder cannot trigger a token refresh', async t => {
  const h = await household(t, { folder: false });
  assert.equal((await h.owner.request(prefix + h.originalId, { method: 'POST' })).status, 404);
  assert.deepEqual(h.calls, { refresh: 0, upload: 0, folder: 0, metadata: 0 });
});

test('disconnect during token refresh prevents Drive calls; revocation in flight suppresses success', async t => {
  const h = await household(t);
  h.onRefresh(async () => {
    assert.equal((await h.backup.request('/api/families/familyA/drive/disconnect',
      { method: 'POST' })).status, 200);
  });
  assert.equal((await h.owner.request(prefix + h.originalId, { method: 'POST' })).status, 404);
  assert.deepEqual(h.calls, { refresh: 1, upload: 0, folder: 0, metadata: 0 });
});
test('revocation during original upload leaves a pending claim and reveals no file ID', async t => {
  const h = await household(t);
  h.onUpload(async () => {
    const accountId = (await (await h.owner.request('/api/session')).json()).accountId;
    assert.equal((await h.backup.request('/api/families/familyA/members/' + accountId + '/revoke',
      { method: 'POST', body: {} })).status, 200);
  });
  const denied = await h.owner.request(prefix + h.originalId, { method: 'POST' });
  assert.equal(denied.status, 404);
  assert.equal((await denied.text()).includes(fileId), false);
  assert.deepEqual(h.calls, { refresh: 1, upload: 1, folder: 0, metadata: 0 });
});

test('concurrent uploads and mismatched provider checksums never create acknowledged duplicates', async t => {
  const h = await household(t);
  let entered, release;
  const started = new Promise(resolve => { entered = resolve; });
  const held = new Promise(resolve => { release = resolve; });
  h.onUpload(async () => { entered(); await held; });
  const first = h.owner.request(prefix + h.originalId, { method: 'POST' });
  await started;
  const second = await h.owner.request(prefix + h.originalId, { method: 'POST' });
  assert.equal(second.status, 409);
  release();
  assert.equal((await first).status, 201);
  assert.deepEqual(h.calls, { refresh: 1, upload: 1, folder: 0, metadata: 0 });
});
test('Drive response with wrong MD5 is not acknowledged and remains pending', async t => {
  const h = await household(t);
  h.corrupt();
  assert.equal((await h.owner.request(prefix + h.originalId, { method: 'POST' })).status, 503);
  assert.equal((await h.owner.request(prefix + h.originalId, { method: 'POST' })).status, 409);
  assert.deepEqual(h.calls, { refresh: 1, upload: 1, folder: 0, metadata: 0 });
});

test('video and audio originals keep exact bytes and native file types', async t => {
  const h = await household(t);
  const video = Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from('ftypisom'),
    Buffer.alloc(16), Buffer.from('invented video')]);
  const response = await h.owner.request('/api/families/familyA/contributions', { method: 'POST',
    body: { id: 'video1', title: 'Invented video', personIds: ['fictional-person'],
      base64: video.toString('base64'), mimeType: 'video/mp4' } });
  assert.equal(response.status, 200);
  const { originalId: videoId } = await response.json();
  assert.equal((await h.owner.request(prefix + videoId, { method: 'POST' })).status, 201);
  const videoFile = [...h.uploaded.values()][0];
  assert.equal(videoFile.metadata.mimeType, 'video/mp4');
  assert.deepEqual(videoFile.bytes, video);

  const audio = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WAVE'),
    Buffer.from('synthetic audio')]);
  const story = await h.owner.request('/api/families/familyA/memories/photo1/stories',
    { method: 'POST', body: { id: 'story1', text: 'Fictional recording', mimeType: 'audio/wav',
      base64: audio.toString('base64') } });
  assert.equal(story.status, 200);
  const { recordingId } = await story.json();
  assert.equal((await h.owner.request(prefix + recordingId, { method: 'POST' })).status, 201);
  const audioFile = [...h.uploaded.values()][1];
  assert.equal(audioFile.metadata.mimeType, 'audio/wav');
  assert.deepEqual(audioFile.bytes, audio);
  assert.deepEqual(h.calls, { refresh: 2, upload: 2, folder: 0, metadata: 0 });
});
