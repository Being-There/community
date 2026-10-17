import test from 'node:test';
import assert from 'node:assert/strict';
import { familyApiFixture, tuple, appOrigin } from './helpers/family-api-fixture.mjs';
import { createSessionService } from '../src/server/sessions.mjs';
const path = (family, resource) => '/api/families/' + family + '/' + resource;
const authenticated = credentials => ({ headers: { cookie: credentials.cookie } });

test('anonymous/profile/invite/forged-cookie requests cannot read private metadata or bytes', async t => {
  const f = await familyApiFixture(t);
  for (const options of [ {}, { headers: { cookie: 'profile=avery; invite=fictional' } }, { headers: { cookie: '__Host-being-there-session=' + 'x'.repeat(43) } } ]) {
    for (const resource of ['memories', 'media/toneA']) {
      const response = await f.request(path('familyA', resource) + '?person=avery&role=organizer', options);
      assert.equal(response.status, 401);
    }
  }
  assert.equal(f.calls.metadata, 0); assert.equal(f.calls.mediaBytes, 0);
});
test('two families sharing identical IDs get only their own metadata and originals', async t => {
  const f = await familyApiFixture(t);
  for (const [account, family, other] of [['alice', 'familyA', 'familyB'], ['bob', 'familyB', 'familyA']]) {
    const credentials = await f.signIn(account);
    const list = await f.request(path(family, 'memories'), authenticated(credentials));
    assert.equal(list.status, 200); assert.equal((await list.json()).memories.length, 2);
    const before = f.calls.mediaBytes;
    for (const resource of ['memories/garden', 'media/toneA']) {
      const response = await f.request(path(other, resource), authenticated(credentials));
      assert.equal(response.status, 404);
      assert.deepEqual(await response.json(), { error: 'Not found' });
    }
    assert.equal(f.calls.mediaBytes, before);
    assert.equal((await f.request(path(family, 'media/toneA'), authenticated(credentials))).status, 200);
  }
});
test('HEAD and all byte-range forms authorize before returning size, MIME or byte metadata', async t => {
  const f = await familyApiFixture(t); const alice = await f.signIn('alice');
  const size = f.media.get(tuple('familyA', 'toneA')).byteLength;
  for (const headers of [{ range: 'bytes=0-3' }, { range: 'bytes=-4' }, { range: 'bytes=4-' }, { range: 'bytes=999999999-' }]) {
    const response = await f.request(path('familyB', 'media/toneA'), { headers: { cookie: alice.cookie, ...headers } });
    assert.equal(response.status, 404); assert.equal(response.headers.get('content-range'), null);
    assert.equal(response.headers.get('accept-ranges'), null);
  }
  const deniedHead = await f.request(path('familyB', 'media/toneA'), { method: 'HEAD', headers: { cookie: alice.cookie } });
  assert.equal(deniedHead.status, 404); assert.equal(deniedHead.headers.get('content-length'), null); assert.equal(f.calls.mediaBytes, 0);
  const head = await f.request(path('familyA', 'media/toneA'), { method: 'HEAD', headers: { cookie: alice.cookie } });
  assert.equal(head.status, 200); assert.equal(head.headers.get('content-length'), String(size)); assert.equal((await head.arrayBuffer()).byteLength, 0);
  const partial = await f.request(path('familyA', 'media/toneA'), { headers: { cookie: alice.cookie, range: 'bytes=0-3' } });
  assert.equal(partial.status, 206); assert.equal(partial.headers.get('content-range'), 'bytes 0-3/' + size);
  assert.equal(await partial.text(), 'RIFF'); assert.equal(partial.headers.get('content-type'), 'audio/wav');
  const suffix = await f.request(path('familyA', 'media/toneA'), { headers: { cookie: alice.cookie, range: 'bytes=-4' } });
  assert.equal(suffix.status, 206); assert.equal((await suffix.arrayBuffer()).byteLength, 4);
  const invalid = await f.request(path('familyA', 'media/toneA'), { headers: { cookie: alice.cookie, range: 'bytes=0-2,4-7' } });
  assert.equal(invalid.status, 416); assert.equal(invalid.headers.get('content-range'), 'bytes */' + size);
});
test('revoked family membership blocks old sessions, derivatives and range retries', async t => {
  const f = await familyApiFixture(t); const alice = await f.signIn('alice');
  const preview = { ...f.media.get(tuple('familyA', 'toneA')), id: 'previewA', originalId: 'toneA', variant: 'playback' };
  f.media.set(tuple('familyA', 'previewA'), preview);
  f.objects.set(tuple('familyA', 'previewA'), f.objects.get(tuple('familyA', 'toneA')));
  assert.equal((await f.request(path('familyA', 'media/previewA'), authenticated(alice))).status, 200);
  f.memberships.get(tuple('alice', 'familyA')).state = 'revoked';
  const before = f.calls.mediaBytes;
  for (const resource of ['memories', 'media/toneA', 'media/previewA']) {
    const response = await f.request(path('familyA', resource), { headers: { cookie: alice.cookie, range: 'bytes=0-3' } });
    assert.equal(response.status, 404);
  }
  assert.equal(f.calls.mediaBytes, before);
});
test('restricted memory scope and retained archives remain restricted regardless of display flags', async t => {
  const f = await familyApiFixture(t); const scoped = await f.signIn('scoped'); const casey = await f.signIn('casey');
  const list = await f.request(path('familyA', 'memories') + '?role=organizer&mode=standard', authenticated(scoped));
  assert.deepEqual((await list.json()).memories.map(row => row.id), ['garden']);
  assert.equal((await f.request(path('familyA', 'media/parkPhoto'), authenticated(scoped))).status, 404);
  // Hidden-from-rotation is not erasure or retained-archive access.
  assert.equal((await f.request(path('familyA', 'memories/park'), authenticated(casey))).status, 200);
  f.memories.get(tuple('familyA', 'park')).retained = true;
  assert.equal((await f.request(path('familyA', 'memories/park') + '?role=organizer', authenticated(casey))).status, 404);
  const alice = await f.signIn('alice');
  assert.equal((await f.request(path('familyA', 'memories/park'), authenticated(alice))).status, 200);
});
test('unknown roles/scopes and active outsiders fail closed', async t => {
  const f = await familyApiFixture(t); const visitor = await f.signIn('visitor'); const alice = await f.signIn('alice');
  assert.equal((await f.request(path('familyA', 'memories'), authenticated(visitor))).status, 404);
  const member = f.memberships.get(tuple('alice', 'familyA'));
  member.scope = { kind: 'new-unsupported-scope' };
  assert.equal((await f.request(path('familyA', 'memories'), authenticated(alice))).status, 404);
  member.scope = { kind: 'family', memoryIds: ['garden'] };
  assert.equal((await f.request(path('familyA', 'memories'), authenticated(alice))).status, 404);
  member.scope = { kind: 'family' }; member.role = 'admin-by-profile';
  assert.equal((await f.request(path('familyA', 'memories'), authenticated(alice))).status, 404);
});
test('logout requires same origin and session-bound CSRF then invalidates the server session', async t => {
  const f = await familyApiFixture(t); const alice = await f.signIn('alice');
  for (const headers of [
    { cookie: alice.cookie },
    { cookie: alice.cookie, origin: 'https://outside.example.test', 'x-csrf-token': alice.csrfToken },
    { cookie: alice.cookie, origin: appOrigin, 'x-csrf-token': 'x'.repeat(43) },
    { cookie: alice.cookie, origin: appOrigin, 'x-csrf-token': alice.csrfToken, 'sec-fetch-site': 'cross-site' }
  ]) assert.equal((await f.request('/api/session/logout', { method: 'POST', headers })).status, 403);
  assert.equal((await f.request('/api/session', authenticated(alice))).status, 200);
  const response = await f.request('/api/session/logout', { method: 'POST', headers: {
    cookie: alice.cookie, origin: appOrigin, 'x-csrf-token': alice.csrfToken, 'sec-fetch-site': 'same-origin'
  } });
  assert.equal(response.status, 204); assert.equal(response.headers.getSetCookie().length, 2);
  assert.equal((await f.request(path('familyA', 'media/toneA'), authenticated(alice))).status, 401);
  assert.equal(f.sessionRows.size, 0);
});
test('session rotation, idle/absolute expiration and account revocation are enforced server-side', async t => {
  const f = await familyApiFixture(t, { absoluteMs: 10000, idleMs: 5000 });
  const first = await f.signIn('alice');
  const second = await f.signIn('alice', new Request(appOrigin, { headers: { cookie: first.cookie } }));
  assert.equal(f.sessionRows.size, 1);
  assert.equal((await f.request('/api/session', authenticated(first))).status, 401);
  assert.equal((await f.request('/api/session', authenticated(second))).status, 200);
  f.advance(5000);
  assert.equal((await f.request('/api/session', authenticated(second))).status, 401);
  const third = await f.signIn('alice');
  f.advance(4000); assert.equal((await f.request('/api/session', authenticated(third))).status, 200);
  f.advance(4000); assert.equal((await f.request('/api/session', authenticated(third))).status, 200);
  f.advance(2000); assert.equal((await f.request('/api/session', authenticated(third))).status, 401);
  const fourth = await f.signIn('alice'); f.accounts.get('alice').state = 'revoked';
  assert.equal((await f.request('/api/session', authenticated(fourth))).status, 401);
});
test('session storage has only token hashes, secure cookie flags, no public test sign-in fallback', async t => {
  const f = await familyApiFixture(t); const alice = await f.signIn('alice');
  const stored = JSON.stringify([...f.sessionRows]);
  assert.doesNotMatch(stored, new RegExp(alice.csrfToken));
  assert.doesNotMatch(stored, new RegExp(alice.sessionCookie.split(';')[0].split('=')[1]));
  assert.match(alice.sessionCookie, /; Secure; SameSite=Lax/); assert.match(alice.sessionCookie, /; HttpOnly/);
  assert.match(alice.sessionCookie, /^__Host-/); assert.doesNotMatch(alice.sessionCookie, /Domain=/);
  assert.throws(() => createSessionService({ repository: f.repository }), /Verified identity adapter/);
  await assert.rejects(f.sessions.signIn({ subject: 'fictional-alice', role: 'organizer' }));
  assert.equal((await f.request('/api/auth/test-sign-in?account=alice')).status, 404);
  const duplicated = alice.cookie + '; ' + alice.sessionCookie.split(';')[0];
  assert.equal((await f.request('/api/session', { headers: { cookie: duplicated } })).status, 401);
});
test('corrupt blobs, mismatched derivative provenance and malformed scoped data expose no payload', async t => {
  const f = await familyApiFixture(t); const alice = await f.signIn('alice');
  f.objects.get(tuple('familyA', 'toneA'))[50] ^= 255;
  const corrupt = await f.request(path('familyA', 'media/toneA'), authenticated(alice));
  assert.equal(corrupt.status, 503); assert.deepEqual(await corrupt.json(), { error: 'Service unavailable' });
  const row = { ...f.media.get(tuple('familyA', 'toneB')), id: 'badPreview', originalId: 'toneA', variant: 'playback' };
  f.media.set(tuple('familyA', 'badPreview'), row);
  const before = f.calls.mediaBytes;
  assert.equal((await f.request(path('familyA', 'media/badPreview'), authenticated(alice))).status, 404);
  assert.equal(f.calls.mediaBytes, before);
  f.repository.listMemories = async () => [{ id: 'secretOtherFamily', familyId: 'familyB', title: 'must not return' }];
  const response = await f.request(path('familyA', 'memories'), authenticated(alice));
  assert.equal(response.status, 503); assert.doesNotMatch(await response.text(), /secretOtherFamily|must not return/);
});
test('revocation or logout during blob I/O is rechecked before delivery', async t => {
  const f = await familyApiFixture(t); const alice = await f.signIn('alice');
  const originalRead = f.repository.getMediaBytes;
  f.repository.getMediaBytes = async (...args) => { const result = await originalRead(...args); f.memberships.get(tuple('alice', 'familyA')).state = 'revoked'; return result; };
  const response = await f.request(path('familyA', 'media/toneA'), authenticated(alice));
  assert.equal(response.status, 404); assert.equal(response.headers.get('content-range'), null);
  f.memberships.get(tuple('alice', 'familyA')).state = 'active';
  f.repository.getMediaBytes = async (...args) => { const result = await originalRead(...args); f.sessionRows.clear(); return result; };
  assert.equal((await f.request(path('familyA', 'media/toneB'), authenticated(alice))).status, 401);
});
test('private responses disable shared caches; untrusted SVG is attachment-only', async t => {
  const f = await familyApiFixture(t); const alice = await f.signIn('alice');
  const response = await f.request(path('familyA', 'media/gardenPhoto'), authenticated(alice));
  assert.equal(response.status, 200); assert.equal(response.headers.get('content-type'), 'application/octet-stream');
  assert.equal(response.headers.get('content-disposition'), 'attachment');
  assert.equal(response.headers.get('cache-control'), 'private, no-store');
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(response.headers.get('cross-origin-resource-policy'), 'same-origin');
  assert.match(response.headers.get('content-security-policy'), /sandbox/);
});
test('recent-auth checks reject stale/client-forged timestamps and changed source accounts', async t => {
  const f = await familyApiFixture(t); const alice = await f.signIn('alice');
  const principal = await f.sessions.authenticate(new Request(appOrigin, { headers: { cookie: alice.cookie } }));
  assert.doesNotThrow(() => f.sessions.requireRecentAuthentication(principal));
  f.advance(300001); assert.throws(() => f.sessions.requireRecentAuthentication(principal));
  assert.throws(() => f.sessions.requireRecentAuthentication({ authenticatedAt: f.now() + 1 }));
  assert.throws(() => f.sessions.requireRecentAuthentication({ authenticatedAt: f.now() }));
  assert.throws(() => f.sessions.requireRecentAuthentication({ ...principal, authenticatedAt: f.now() }));
  f.repository.findAccountByIdentity = async () => ({ ...f.accounts.get('alice'), subject: 'different-subject' });
  await assert.rejects(f.sessions.signIn('alice'));
});

test('story metadata preserves separate contributors and cannot cross memory/family scope', async t => {
  const f = await familyApiFixture(t); const alice = await f.signIn('alice');
  const response = await f.request(path('familyA', 'memories/garden/stories'), authenticated(alice));
  assert.equal(response.status, 200);
  const stories = (await response.json()).stories;
  assert.deepEqual(stories.map(story => story.contributorId), ['casey', 'morgan']);
  assert.deepEqual(stories.map(story => story.recordingId), ['toneA', 'toneB']);
  assert.equal((await f.request(path('familyB', 'memories/garden/stories'), authenticated(alice))).status, 404);
  f.stories.get(tuple('familyA', 'storyA')).recordingId = 'toneB';
  assert.equal((await f.request(path('familyA', 'memories/garden/stories'), authenticated(alice))).status, 503);
});
test('metadata I/O does not bypass a membership revoked before response delivery', async t => {
  const f = await familyApiFixture(t); const alice = await f.signIn('alice');
  const original = f.repository.listMemories;
  f.repository.listMemories = async (...args) => { const result = await original(...args); f.memberships.get(tuple('alice', 'familyA')).state = 'revoked'; return result; };
  const response = await f.request(path('familyA', 'memories'), authenticated(alice));
  assert.equal(response.status, 404); assert.deepEqual(await response.json(), { error: 'Not found' });
});
test('media removed or relinked during I/O is not returned from stale metadata', async t => {
  const f = await familyApiFixture(t); const alice = await f.signIn('alice');
  const originalRead = f.repository.getMediaBytes;
  f.repository.getMediaBytes = async (...args) => { const result = await originalRead(...args); f.media.get(tuple('familyA', 'toneA')).memoryId = 'park'; return result; };
  assert.equal((await f.request(path('familyA', 'media/toneA'), authenticated(alice))).status, 404);
});
test('changing an identity binding invalidates existing sessions rather than transferring access', async t => {
  const f = await familyApiFixture(t); const alice = await f.signIn('alice');
  f.accounts.get('alice').subject = 'fictional-replacement-identity';
  assert.equal((await f.request('/api/session', authenticated(alice))).status, 401);
});
