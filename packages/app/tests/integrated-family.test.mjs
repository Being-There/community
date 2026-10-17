import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { webcrypto, createHash } from 'node:crypto';
import { archiveFamilyFixture } from '../examples/archive-family.mjs';
import { originalStorageKey } from '../src/core/original-storage.mjs';
import { integratedFixture } from './helpers/integrated-app-fixture.mjs';
import { decodeArchiveFiles } from '../src/server/archive-transport.mjs';
import { prepareFamilyRestore } from '../src/core/family-archive.mjs';
const json = async response => { const result = await response.json(); assert.ok(response.ok, result.error); return result; };
async function household(t) {
  const f = await integratedFixture(t); const owner = await f.login('fictional-owner', 'owner@family.example.test');
  assert.equal(owner.callback.status, 303);
  const bootstrap = f.repository.bootstrapInvitation({ familyId: 'familyA', label: 'Fictional household', email: 'owner@family.example.test' });
  await json(await owner.request('/api/invitations/accept', { method: 'POST', body: { token: bootstrap.token, displayName: 'Fictional owner' } }));
  await json(await owner.request('/api/families/familyA/people', { method: 'POST', body: { id: 'avery', displayName: 'Avery (fictional)' } }));
  await json(await owner.request('/api/families/familyA/people', { method: 'POST', body: { id: 'riley', displayName: 'Riley (fictional)' } }));
  return { f, owner };
}
async function photograph(owner, id = 'photo1') {
  const bytes = await sharp({ create: { width: 16, height: 12, channels: 3, background: '#73a578' } }).png().toBuffer();
  const body = { id, title: 'A fictional garden', personIds: ['avery', 'riley'], base64: bytes.toString('base64') };
  const response = await json(await owner.request('/api/families/familyA/contributions', { method: 'POST', body }));
  return { bytes, body, response };
}
test('signed OIDC → invitation → durable photo → separate stories → playback → export → isolated restore', async t => {
  const { f, owner } = await household(t);
  const { bytes, response } = await photograph(owner);
  assert.equal(response.durable, true);
  const guest = await f.login('fictional-guest', 'guest@family.example.test');
  assert.equal((await guest.request('/api/families/familyA/memories')).status, 404);
  const invitation = await json(await owner.request('/api/families/familyA/invitations', { method: 'POST', body: { email: 'guest@family.example.test', role: 'contributor' } }));
  const preview = await json(await guest.request('/api/invitations/preview', { method: 'POST', body: { token: invitation.token } }));
  assert.equal(preview.family.label, 'Fictional household'); assert.equal(preview.role, 'contributor');
  await json(await guest.request('/api/invitations/accept', { method: 'POST', body: { token: invitation.token, displayName: 'Fictional guest' } }));
  await json(await owner.request('/api/families/familyA/memories/photo1/stories', { method: 'POST', body: { id: 'story1', text: 'One independent perspective.' } }));
  const audioFixture = await archiveFamilyFixture();
  const audioOriginal = audioFixture.content.originals.find(row => row.kind === 'audio');
  const audioBytes = await audioFixture.store.get(originalStorageKey(audioOriginal));
  const saved = await json(await guest.request('/api/families/familyA/memories/photo1/stories', { method: 'POST', body: { id: 'story2', text: 'Another independent perspective.', mimeType: 'audio/wav', base64: Buffer.from(audioBytes).toString('base64') } }));
  assert.equal(saved.durable, true);
  const playback = await guest.request('/api/families/familyA/media/' + saved.recordingId, { headers: { range: 'bytes=0-3' } });
  assert.equal(playback.status, 206); assert.equal(await playback.text(), 'RIFF');
  const stories = await json(await guest.request('/api/families/familyA/memories/photo1/stories'));
  assert.equal(stories.stories.length, 2); assert.notEqual(stories.stories[0].contributorId, stories.stories[1].contributorId);
  const media = await guest.request('/api/families/familyA/media/' + response.originalId);
  assert.equal(media.status, 200); assert.deepEqual(Buffer.from(await media.arrayBuffer()), bytes);
  f.reopen(); // Original bytes, identities, sessions and relationships survive close/reopen.
  assert.equal((await owner.request('/api/families/familyA/memories')).status, 200);
  const exported = await json(await owner.request('/api/families/familyA/exports', { method: 'POST' }));
  const files = decodeArchiveFiles(exported);
  const restored = await prepareFamilyRestore({ files, expectedFamilyId: 'familyA', targetFamilyId: 'restoredFamily', subtleCrypto: webcrypto.subtle });
  assert.equal(f.repository.commitIsolatedRestore(restored).access, 'disabled');
  assert.deepEqual(f.repository.getMediaBytes('restoredFamily', response.originalId), Uint8Array.from(bytes));
  assert.equal((await owner.request('/api/families/restoredFamily/memories')).status, 404);
  assert.throws(() => f.repository.commitIsolatedRestore(restored));
});
test('idempotent retries preserve originals; conflicting retries and foreign scopes cannot overwrite', async t => {
  const { f, owner } = await household(t); const p = await photograph(owner);
  const retry = await json(await owner.request('/api/families/familyA/contributions', { method: 'POST', body: p.body }));
  assert.equal(retry.alreadyPresent, true);
  assert.equal((await owner.request('/api/families/familyA/contributions', { method: 'POST', body: { ...p.body, title: 'Conflict' } })).status, 409);
  const outsider = await f.login('fictional-outsider', 'outsider@family.example.test');
  assert.equal((await outsider.request('/api/families/familyA/contributions', { method: 'POST', body: p.body })).status, 404);
  assert.deepEqual(f.repository.getMediaBytes('familyA', p.response.originalId), Uint8Array.from(p.bytes));
});
test('invites reject wrong recipients, replay, expiry, revocation and role injection', async t => {
  const { f, owner } = await household(t); const guest = await f.login('fictional-guest', 'guest@family.example.test'); const outsider = await f.login('fictional-other', 'other@family.example.test');
  const create = () => owner.request('/api/families/familyA/invitations', { method: 'POST', body: { email: 'guest@family.example.test', role: 'contributor' } }).then(json);
  const invite = await create();
  assert.equal((await outsider.request('/api/invitations/preview', { method: 'POST', body: { token: invite.token } })).status, 404);
  assert.equal((await outsider.request('/api/invitations/accept', { method: 'POST', body: { token: invite.token } })).status, 404);
  assert.equal((await guest.request('/api/invitations/accept', { method: 'POST', body: { token: invite.token, role: 'organizer' } })).status, 400);
  const revoked = await create(); await json(await owner.request('/api/families/familyA/invitations/' + revoked.id + '/revoke', { method: 'POST' }));
  assert.equal((await guest.request('/api/invitations/accept', { method: 'POST', body: { token: revoked.token } })).status, 404);
  await json(await guest.request('/api/invitations/accept', { method: 'POST', body: { token: invite.token } }));
  assert.equal((await guest.request('/api/invitations/accept', { method: 'POST', body: { token: invite.token } })).status, 404);
  assert.equal((await guest.request('/api/families/familyA/exports', { method: 'POST' })).status, 404);
});
test('last organizer survives revocation attempts; revoked members lose existing durable sessions', async t => {
  const { f, owner } = await household(t); const accountId = (await json(await owner.request('/api/session'))).accountId;
  assert.equal((await owner.request('/api/families/familyA/members/' + accountId + '/revoke', { method: 'POST' })).status, 409);
  const guest = await f.login('fictional-guest', 'guest@family.example.test');
  const invite = await json(await owner.request('/api/families/familyA/invitations', { method: 'POST', body: { email: 'guest@family.example.test', role: 'contributor' } }));
  await json(await guest.request('/api/invitations/accept', { method: 'POST', body: { token: invite.token } }));
  const guestId = (await json(await guest.request('/api/session'))).accountId;
  await json(await owner.request('/api/families/familyA/members/' + guestId + '/revoke', { method: 'POST' }));
  f.reopen(); assert.equal((await guest.request('/api/families/familyA/memories')).status, 404);
});
test('Google verifier binds browser, state, PKCE, nonce, audience and one-use callback', async t => {
  const f = await integratedFixture(t); const login = await f.login('fixture-good', 'good@family.example.test'); assert.equal(login.callback.status, 303);
  assert.equal((await f.request(login.callbackPath, { cookie: login.browserCookie })).status, 401);
  for (const overrides of [{ nonce: 'wrong' }, { aud: 'wrong' }, { iss: 'https://attacker.example.test' }, { exp: 1 }]) {
    assert.equal((await f.login('fixture-bad', 'bad@family.example.test', overrides)).callback.status, 401);
  }
  const thirdParty = await f.login('fixture-thirdparty', 'someone@example.test');
  assert.equal(thirdParty.callback.status, 303); assert.equal(f.repository.findAccountByIdentity('https://accounts.google.com', 'fixture-thirdparty').verifiedEmail, null);
  const start = await f.request('/auth/google/start'); const url = new URL(start.headers.get('location'));
  assert.equal((await f.request('/auth/google/callback?code=fixture-code&state=' + url.searchParams.get('state'), { cookie: '__Host-being-there-login=' + 'a'.repeat(43) })).status, 401);
});
test('invalid/active images, unknown people, CSRF and stale export fail without writes', async t => {
  const { f, owner } = await household(t);
  const body = { id: 'bad', title: 'Bad file', personIds: ['avery'], base64: Buffer.from('<svg onload="alert(1)"></svg>').toString('base64') };
  assert.equal((await owner.request('/api/families/familyA/contributions', { method: 'POST', body })).status, 415);
  const p = await photograph(owner);
  assert.equal((await owner.request('/api/families/familyA/contributions', { method: 'POST', body: { ...p.body, id: 'foreign-person', personIds: ['missing'] } })).status, 400);
  assert.equal((await owner.request('/api/families/familyA/contributions', { method: 'POST', body: p.body, headers: { origin: 'https://attacker.example.test' } })).status, 403);
  f.advance(300001);
  assert.equal((await owner.request('/api/families/familyA/exports', { method: 'POST' })).status, 403);
  assert.equal(f.repository.listMemories('familyA').length, 1);
});

test('independent originals recover content after the application database is removed', async t => {
  const { f, owner } = await household(t); const p = await photograph(owner);
  await json(await owner.request('/api/families/familyA/memories/photo1/stories', { method: 'POST', body: { id: 'independent-story', text: 'Kept independently from the database.' } }));
  const { readdir, readFile, rm } = await import('node:fs/promises'); const { join } = await import('node:path');
  const folder = join(f.directory, 'original-archive', 'familyA', 'snapshots');
  let snapshot;
  for (const name of await readdir(folder)) { const value = JSON.parse(await readFile(join(folder, name), 'utf8')); if (value.content.stories.length === 1) snapshot = join(folder, name); }
  assert.ok(snapshot);
  f.repository.close();
  for (const name of ['family.sqlite', 'family.sqlite-wal', 'family.sqlite-shm']) await rm(join(f.directory, name), { force: true });
  const { readIndependentArchiveSnapshot } = await import('../src/server/independent-archive.mjs');
  // Recovery must work using only a copied archive, not the original storage.
  const { cp } = await import('node:fs/promises');
  const independentCopy = join(f.directory, 'separate-storage', 'familyA');
  await cp(join(f.directory, 'original-archive', 'familyA'), independentCopy, { recursive: true });
  await rm(join(f.directory, 'original-archive'), { recursive: true, force: true });
  const copiedSnapshot = join(independentCopy, 'snapshots', snapshot.split('/').at(-1));
  const files = await readIndependentArchiveSnapshot(copiedSnapshot);
  const restored = await prepareFamilyRestore({ files, expectedFamilyId: 'familyA', targetFamilyId: 'freshFamily', subtleCrypto: webcrypto.subtle });
  const { openFamilyRepository } = await import('../src/server/sqlite-repository.mjs');
  const destination = openFamilyRepository({ filename: join(f.directory, 'fresh', 'family.sqlite') });
  try {
    destination.commitIsolatedRestore(restored);
    assert.deepEqual(destination.getMediaBytes('freshFamily', p.response.originalId), Uint8Array.from(p.bytes));
    assert.equal(destination.listStories('freshFamily', 'photo1').length, 1);
    assert.equal(destination.listMembers('freshFamily').length, 0);
  } finally { destination.close(); }
});
test('expired browser-bound OAuth attempts and expired invitations cannot be reused', async t => {
  const { f, owner } = await household(t);
  const invite = await json(await owner.request('/api/families/familyA/invitations', { method: 'POST', body: { email: 'later@family.example.test', role: 'contributor' } }));
  const later = await f.login('fixture-later', 'later@family.example.test');
  const principal = await f.app.sessions.authenticate(new Request('https://family.example.test', { headers: { cookie: later.cookie } }));
  const start = await f.request('/auth/google/start'); const url = new URL(start.headers.get('location'));
  f.advance(600001);
  assert.equal((await f.request('/auth/google/callback?code=fixture-code&state=' + url.searchParams.get('state'), { cookie: start.headers.getSetCookie()[0].split(';')[0] })).status, 401);
  f.advance(7 * 86400000);
  assert.throws(() => f.repository.previewInvitation(principal, invite.token));
  assert.equal((await later.request('/api/invitations/accept', { method: 'POST', body: { token: invite.token } })).status, 401);
});

test('short family video preserves original bytes, access isolation, range playback and restored grants', async t => {
  const { f, owner } = await household(t);
  // Minimal synthetic MP4 container marker: transport/storage test, not codec playback.
  const videoBytes = Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from('ftypisom'), Buffer.alloc(16), Buffer.from('fictional media bytes')]);
  const input = { id: 'video1', title: 'An invented short clip', personIds: ['avery'],
    base64: videoBytes.toString('base64'), mimeType: 'video/mp4' };
  const saved = await json(await owner.request('/api/families/familyA/contributions', { method: 'POST', body: input }));
  assert.equal(saved.durable, true);
  assert.equal((await json(await owner.request('/api/families/familyA/memories'))).memories.find(row => row.id === input.id)?.mediaKind, 'video');
  const response = await owner.request('/api/families/familyA/media/' + saved.originalId);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'video/mp4');
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), videoBytes);
  const range = await owner.request('/api/families/familyA/media/' + saved.originalId, { headers: { range: 'bytes=4-7' } });
  assert.equal(range.status, 206);
  assert.equal(await range.text(), 'ftyp');
  const outsider = await f.login('fictional-video-outsider', 'outsider@family.example.test');
  assert.equal((await outsider.request('/api/families/familyA/media/' + saved.originalId)).status, 404);
  const wrong = await owner.request('/api/families/familyA/contributions', {
    method: 'POST', body: { ...input, id: 'badvideo', mimeType: 'video/webm' }
  });
  assert.equal(wrong.status, 415);
  const exported = await json(await owner.request('/api/families/familyA/exports', { method: 'POST' }));
  const restored = await prepareFamilyRestore({
    files: decodeArchiveFiles(exported), expectedFamilyId: 'familyA', targetFamilyId: 'videoRecovery',
    subtleCrypto: webcrypto.subtle
  });
  assert.equal(f.repository.commitIsolatedRestore(restored).access, 'disabled');
  assert.deepEqual(Buffer.from(f.repository.getMediaBytes('videoRecovery', saved.originalId)), videoBytes);
  assert.equal((await owner.request('/api/families/videoRecovery/memories')).status, 404);
});
