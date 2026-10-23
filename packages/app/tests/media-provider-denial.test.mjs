import test from 'node:test';
import assert from 'node:assert/strict';
import { familyApiFixture, tuple } from './helpers/family-api-fixture.mjs';

// Treat the media byte adapter as the future Google Drive token/API boundary.
// This regression test requires denied requests to stop before either call.
test('denied media GET, HEAD and Range requests never reach a provider adapter', async t => {
  const f = await familyApiFixture(t);
  const provider = { tokenLoads: 0, apiCalls: 0 };
  const localRead = f.repository.getMediaBytes.bind(f.repository);
  f.repository.getMediaBytes = async (...args) => {
    provider.tokenLoads++;
    provider.apiCalls++;
    return localRead(...args);
  };
  const outsider = await f.signIn('visitor');
  const member = await f.signIn('alice');
  const otherFamily = await f.signIn('bob');
  const scoped = await f.signIn('scoped');
  const denied = [
    { path: '/api/families/familyA/media/toneA', options: {}, status: 401 },
    { path: '/api/families/familyA/media/toneA', options: { headers: { cookie: outsider.cookie } }, status: 404 },
    { path: '/api/families/familyB/media/toneA', options: { headers: { cookie: member.cookie, range: 'bytes=0-3' } }, status: 404 },
    { path: '/api/families/familyA/media/toneA', options: { method: 'HEAD', headers: { cookie: otherFamily.cookie } }, status: 404 },
    { path: '/api/families/familyA/media/parkPhoto', options: { headers: { cookie: scoped.cookie, range: 'bytes=-4' } }, status: 404 },
    { path: '/api/families/familyB/media/toneA?variant=small', options: { headers: { cookie: member.cookie } }, status: 404 }
  ];
  for (const { path, options, status } of denied) {
    const response = await f.request(path, options);
    assert.equal(response.status, status, path);
    assert.equal(response.headers.get('content-range'), null);
    assert.equal(response.headers.get('accept-ranges'), null);
    assert.equal(provider.tokenLoads, 0, 'token boundary reached on denied request');
    assert.equal(provider.apiCalls, 0, 'provider boundary reached on denied request');
  }
  f.memberships.get(tuple('alice', 'familyA')).state = 'revoked';
  for (const options of [
    { headers: { cookie: member.cookie } },
    { method: 'HEAD', headers: { cookie: member.cookie } },
    { headers: { cookie: member.cookie, range: 'bytes=0-1' } }
  ]) {
    const response = await f.request('/api/families/familyA/media/toneA', options);
    assert.equal(response.status, 404);
    assert.equal(provider.tokenLoads, 0);
    assert.equal(provider.apiCalls, 0);
  }
});

test('revocation while resolving media metadata blocks token and provider calls before GET, HEAD, Range and size errors', async t => {
  const f = await familyApiFixture(t);
  const member = await f.signIn('alice');
  const membership = f.memberships.get(tuple('alice', 'familyA'));
  const originalGetMemory = f.repository.getMemory.bind(f.repository);
  const originalGetMediaBytes = f.repository.getMediaBytes.bind(f.repository);
  let tokenLoads = 0, providerCalls = 0;
  f.repository.getMediaBytes = async (...args) => {
    tokenLoads++;
    providerCalls++;
    return originalGetMediaBytes(...args);
  };
  for (const { method, range } of [
    { method: 'GET' },
    { method: 'HEAD' },
    { method: 'GET', range: 'bytes=0-3' },
    { method: 'GET', range: 'bytes=999999-' }
  ]) {
    membership.state = 'active';
    let revokedDuringMetadata = false;
    f.repository.getMemory = async (familyId, memoryId) => {
      const row = await originalGetMemory(familyId, memoryId);
      if (!revokedDuringMetadata && familyId === 'familyA') {
        revokedDuringMetadata = true;
        membership.state = 'revoked';
      }
      return row;
    };
    const response = await f.request('/api/families/familyA/media/toneA', {
      method, headers: { cookie: member.cookie, ...(range ? { range } : {}) }
    });
    assert.equal(revokedDuringMetadata, true, 'test did not revoke during metadata lookup');
    assert.equal(response.status, 404, method + ' ' + (range ?? 'full'));
    assert.equal(response.headers.get('content-range'), null, 'denial leaked byte length');
    assert.equal(response.headers.get('accept-ranges'), null, 'denial leaked media metadata');
    assert.equal(tokenLoads, 0, 'denied request loaded provider credentials');
    assert.equal(providerCalls, 0, 'denied request contacted media provider');
  }
});
