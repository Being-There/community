import test from 'node:test';
import assert from 'node:assert/strict';
import { integratedFixture, origin } from './helpers/integrated-app-fixture.mjs';
import { createFamilyProviderGate } from '../src/server/family-provider-gate.mjs';

const body = async response => {
  assert.equal(response.status, 200);
  return response.json();
};
async function household(t) {
  const fixture = await integratedFixture(t);
  const owner = await fixture.login('provider-owner', 'owner@family.example.test');
  const bootstrap = fixture.repository.bootstrapInvitation({ familyId: 'familyA', label: 'Synthetic family', email: 'owner@family.example.test' });
  await body(await owner.request('/api/invitations/accept', { method: 'POST', body: { token: bootstrap.token, displayName: 'Owner' } }));
  return { fixture, owner };
}
function providerGate(fixture, overrides = {}) {
  const calls = { tokens: 0, provider: 0 };
  const gate = createFamilyProviderGate({
    sessions: fixture.app.sessions, repository: fixture.repository, appOrigin: origin,
    loadToken: async args => { calls.tokens++; return overrides.loadToken ? overrides.loadToken(args) : 'synthetic-server-only-token'; },
    callProvider: async args => { calls.provider++; return overrides.callProvider ? overrides.callProvider(args) : { ok: true }; }
  });
  return { gate, calls };
}
function request(user, { familyId = 'familyA', mode = 'read', originHeader = origin, csrf, memoryId, operation = 'files_read' } = {}) {
  const method = mode === 'read' ? 'GET' : 'POST';
  const req = new Request(origin + '/api/families/' + familyId + '/provider', {
    method,
    headers: {
      cookie: user?.cookie ?? '',
      ...(method === 'POST' ? { origin: originHeader, 'x-csrf-token': csrf ?? user?.csrf ?? '' } : {})
    }
  });
  return { request: req, familyId, mode, operation, ...(memoryId === undefined ? {} : { memoryId }) };
}
async function denied(gate, input) {
  await assert.rejects(gate.run(input), error => [401, 403, 404, 405].includes(error?.status));
}

test('anonymous, signed-in nonmember, cross-family and revoked users never load provider tokens', async t => {
  const { fixture, owner } = await household(t);
  const outsider = await fixture.login('provider-outsider', 'outsider@family.example.test');
  const other = await fixture.login('provider-other-owner', 'other@family.example.test');
  const bootstrap = fixture.repository.bootstrapInvitation({ familyId: 'familyB', label: 'Other synthetic family', email: 'other@family.example.test' });
  await body(await other.request('/api/invitations/accept', { method: 'POST', body: { token: bootstrap.token } }));
  const { gate, calls } = providerGate(fixture);
  await denied(gate, request(null));
  await denied(gate, request(outsider));
  await denied(gate, request(other));
  await denied(gate, request(other, { familyId: 'familyA', mode: 'write' }));
  assert.deepEqual(calls, { tokens: 0, provider: 0 });
  const invite = await body(await owner.request('/api/families/familyA/invitations', { method: 'POST', body: { email: 'outsider@family.example.test', role: 'contributor' } }));
  await body(await outsider.request('/api/invitations/accept', { method: 'POST', body: { token: invite.token } }));
  assert.deepEqual(await gate.run(request(outsider)), { ok: true });
  assert.deepEqual(calls, { tokens: 1, provider: 1 });
  const account = await body(await outsider.request('/api/session'));
  await body(await owner.request('/api/families/familyA/members/' + account.accountId + '/revoke', { method: 'POST' }));
  await denied(gate, request(outsider));
  assert.deepEqual(calls, { tokens: 1, provider: 1 }, 'revocation cannot trigger another token or API call');
});

test('invalid CSRF, Origin, role and resource scope deny before provider token access', async t => {
  const { fixture, owner } = await household(t);
  const guest = await fixture.login('provider-guest', 'guest@family.example.test');
  const invite = await body(await owner.request('/api/families/familyA/invitations', { method: 'POST', body: { email: 'guest@family.example.test', role: 'contributor' } }));
  await body(await guest.request('/api/invitations/accept', { method: 'POST', body: { token: invite.token } }));
  const { gate, calls } = providerGate(fixture);
  await denied(gate, request(owner, { mode: 'write', csrf: 'invalid' }));
  await denied(gate, request(owner, { mode: 'write', originHeader: 'https://attacker.example.test' }));
  await denied(gate, request(guest, { mode: 'organizer' }));
  await denied(gate, request(guest, { memoryId: 'nonexistent' }));
  await denied(gate, request(owner, { memoryId: 'nonexistent' }));
  assert.deepEqual(calls, { tokens: 0, provider: 0 });
  assert.deepEqual(await gate.run(request(owner, { mode: 'organizer' })), { ok: true });
  assert.deepEqual(calls, { tokens: 1, provider: 1 });
});

test('membership revoked while loading a token prevents any provider API call or content', async t => {
  const { fixture, owner } = await household(t);
  const guest = await fixture.login('provider-revoked-midflight', 'guest@family.example.test');
  const invite = await body(await owner.request('/api/families/familyA/invitations', { method: 'POST', body: { email: 'guest@family.example.test', role: 'contributor' } }));
  await body(await guest.request('/api/invitations/accept', { method: 'POST', body: { token: invite.token } }));
  const account = await body(await guest.request('/api/session'));
  const { gate, calls } = providerGate(fixture, { loadToken: async () => {
    await body(await owner.request('/api/families/familyA/members/' + account.accountId + '/revoke', { method: 'POST' }));
    return 'synthetic-token';
  } });
  await denied(gate, request(guest));
  assert.deepEqual(calls, { tokens: 1, provider: 0 });
});

test('revocation during provider response prevents the result being returned', async t => {
  const { fixture, owner } = await household(t);
  const guest = await fixture.login('provider-revoked-during-call', 'guest@family.example.test');
  const invite = await body(await owner.request('/api/families/familyA/invitations', { method: 'POST', body: { email: 'guest@family.example.test', role: 'contributor' } }));
  await body(await guest.request('/api/invitations/accept', { method: 'POST', body: { token: invite.token } }));
  const account = await body(await guest.request('/api/session'));
  const { gate, calls } = providerGate(fixture, { callProvider: async () => {
    await body(await owner.request('/api/families/familyA/members/' + account.accountId + '/revoke', { method: 'POST' }));
    return { secret: 'must-not-return' };
  } });
  await denied(gate, request(guest));
  assert.deepEqual(calls, { tokens: 1, provider: 1 });
});
