import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { integratedFixture } from './helpers/integrated-app-fixture.mjs';

// Release regression: authenticating to Google never grants family access.
// All media endpoints, including HEAD and byte ranges, need an active invitation-derived membership.
test('anonymous and non-invited Google users cannot read, mutate or export a family', async t => {
  const fixture = await integratedFixture(t);
  const invitation = fixture.repository.bootstrapInvitation({
    familyId: 'familyA', label: 'Synthetic protected household', email: 'owner@gmail.com'
  });
  const owner = await fixture.login('real-owner-subject', 'owner@gmail.com');
  const outsider = await fixture.login('stranger-subject', 'stranger@gmail.com');

  // A Google login creates an account, not a family authorization.
  assert.equal((await outsider.request('/api/session')).status, 200);
  const outsideFamilies = await outsider.request('/api/families');
  assert.equal(outsideFamilies.status, 200);
  assert.deepEqual((await outsideFamilies.json()).families, []);
  assert.equal((await outsider.request('/api/invitations/preview', {
    method: 'POST', body: { token: invitation.token }
  })).status, 404);
  assert.equal((await outsider.request('/api/invitations/accept', {
    method: 'POST', body: { token: invitation.token }
  })).status, 404);

  // Possessing an invitation URL is insufficient without the recipient's verified Google identity.
  assert.equal((await owner.request('/api/families/familyA/memories')).status, 404);
  assert.equal((await owner.request('/api/invitations/accept', {
    method: 'POST', body: { token: invitation.token, displayName: 'Fictional organizer' }
  })).status, 200);

  const person = await owner.request('/api/families/familyA/people', {
    method: 'POST', body: { id: 'personA', displayName: 'Imaginary relative' }
  });
  assert.equal(person.status, 201);
  const png = await sharp({ create: { width: 64, height: 64, channels: 3, background: '#738e91' } }).png().toBuffer();
  const upload = await owner.request('/api/families/familyA/contributions', {
    method: 'POST',
    body: { id: 'memoryA', title: 'A wholly fictional photograph', personIds: ['personA'], base64: png.toString('base64') }
  });
  assert.equal(upload.status, 200);
  const { originalId } = await upload.json();

  const privateRoutes = [
    '/api/families/familyA/memories',
    '/api/families/familyA/memories/memoryA',
    '/api/families/familyA/memories/memoryA/stories',
    '/api/families/familyA/media/' + originalId,
    '/api/families/familyA/media/' + originalId + '?variant=small',
    '/api/families/familyA/people',
    '/api/families/familyA/contributors',
    '/api/families/familyA/members',
    '/api/families/familyA/invitations'
  ];

  for (const path of privateRoutes) {
    const anon = await fixture.request(path);
    assert.equal(anon.status, 401, 'anonymous GET denied: ' + path);
    assert.equal((await anon.text()).includes('fictional photograph'), false);
    const stranger = await outsider.request(path);
    assert.equal(stranger.status, 404, 'signed-in nonmember GET denied: ' + path);
    assert.equal((await stranger.text()).includes('fictional photograph'), false);
  }

  const mediaPath = '/api/families/familyA/media/' + originalId;
  assert.equal((await owner.request(mediaPath)).status, 200);
  for (const options of [
    { method: 'HEAD' },
    { headers: { range: 'bytes=0-31' } },
    { headers: { range: 'bytes=-16' } }
  ]) {
    assert.equal((await fixture.request(mediaPath, options)).status, 401, 'anonymous media denied');
    assert.equal((await outsider.request(mediaPath, options)).status, 404, 'nonmember media denied');
  }

  const mutations = [
    ['/api/families/familyA/people', { id: 'intruder', displayName: 'Intruder' }],
    ['/api/families/familyA/invitations', { role: 'organizer', email: 'stranger@gmail.com' }],
    ['/api/families/familyA/contributions', { id: 'intruder', title: 'Nope', personIds: ['personA'], base64: png.toString('base64') }],
    ['/api/families/familyA/memories/memoryA/stories', { id: 'storyBad', text: 'Nope' }],
    ['/api/families/familyA/exports', {}]
  ];
  for (const [path, body] of mutations) {
    assert.equal((await fixture.request(path, { method: 'POST', body })).status, 401, 'anonymous write denied: ' + path);
    assert.equal((await outsider.request(path, { method: 'POST', body })).status, 404, 'nonmember write denied: ' + path);
  }
  // There is deliberately no native Drive token/Drive API route in this preview.
  assert.equal((await fixture.request('/api/drive/files')).status, 404);
  assert.equal((await outsider.request('/api/drive/files')).status, 404);
});

test('membership revocation blocks an existing session on subsequent reads', async t => {
  const fixture = await integratedFixture(t);
  const organizerInvite = fixture.repository.bootstrapInvitation({ familyId: 'familyA', label: 'Fictional family', email: 'organizer@gmail.com' });
  const organizer = await fixture.login('organizer-subject', 'organizer@gmail.com');
  assert.equal((await organizer.request('/api/invitations/accept', { method: 'POST', body: { token: organizerInvite.token } })).status, 200);
  const invited = await organizer.request('/api/families/familyA/invitations', {
    method: 'POST', body: { role: 'contributor', email: 'contributor@gmail.com' }
  });
  assert.equal(invited.status, 201);
  const token = (await invited.json()).token;
  const member = await fixture.login('member-subject', 'contributor@gmail.com');
  assert.equal((await member.request('/api/invitations/accept', { method: 'POST', body: { token } })).status, 200);
  assert.equal((await member.request('/api/families/familyA/memories')).status, 200);
  const members = await organizer.request('/api/families/familyA/members');
  assert.equal(members.status, 200);
  const contributor = (await members.json()).members.find(value => value.email === 'contributor@gmail.com');
  assert.ok(contributor?.accountId);
  assert.equal((await organizer.request('/api/families/familyA/members/' + contributor.accountId + '/revoke', {
    method: 'POST', body: {}
  })).status, 200);
  assert.equal((await member.request('/api/families/familyA/memories')).status, 404);
  assert.equal((await member.request('/api/families/familyA/people')).status, 404);
});
