import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { archiveFamilyFixture } from '../examples/archive-family.mjs';
import { createFamilyArchive, inspectFamilyArchive, prepareFamilyRestore, validateArchiveContent } from '../src/core/family-archive.mjs';
import { originalStorageKey } from '../src/core/original-storage.mjs';
const encoder = new TextEncoder();
const decoder = new TextDecoder();
const encode = value => encoder.encode(JSON.stringify(value));
async function setup() {
  const fixture = await archiveFamilyFixture();
  const files = await createFamilyArchive(fixture);
  return { ...fixture, files };
}
// Rehash malicious metadata too: semantic validation must not rely only on checksums.
async function replace(files, path, update) {
  files.set(path, encode(update(JSON.parse(decoder.decode(files.get(path))))));
  const manifest = JSON.parse(decoder.decode(files.get('manifest.json')));
  const entry = manifest.files.find(entry => entry.path === path);
  entry.byteLength = files.get(path).length;
  entry.sha256 = Buffer.from(await webcrypto.subtle.digest('SHA-256', files.get(path))).toString('hex');
  files.set('manifest.json', encode(manifest));
}
test('round trip preserves people, attribution, hidden status, stories and exact original bytes', async () => {
  const fixture = await setup();
  const checked = await inspectFamilyArchive(fixture);
  assert.deepEqual(checked.content, fixture.content);
  const restored = await prepareFamilyRestore({ ...fixture, targetFamilyId: 'newFamily' });
  assert.equal(restored.content.family.id, 'newFamily');
  for (const name of ['people', 'contributors', 'memories', 'stories', 'originals'])
    assert.ok(restored.content[name].every(record => record.familyId === 'newFamily'));
  assert.deepEqual(restored.content.memories[0].personIds, ['avery', 'riley']);
  assert.equal(restored.content.memories[1].hidden, true);
  assert.deepEqual(restored.content.stories.map(story => story.contributorId), ['casey', 'morgan']);
  for (const original of fixture.content.originals)
    assert.deepEqual(restored.originals.get(original.id), await fixture.store.get(originalStorageKey(original)));
  assert.deepEqual(restored.access, { state: 'disabled', memberships: [], invitations: [], sessions: [] });
});
test('missing, modified, truncated and extra files are rejected', async () => {
  const fixture = await setup();
  for (const damage of [
    files => files.delete('originals/toneA'),
    files => { files.get('originals/toneA')[10] ^= 255; },
    files => files.set('originals/toneA', files.get('originals/toneA').slice(0, -1)),
    files => files.set('extra.json', encode({}))
  ]) {
    const files = new Map([...fixture.files].map(([key, bytes]) => [key, Uint8Array.from(bytes)]));
    damage(files);
    await assert.rejects(prepareFamilyRestore({ ...fixture, files, targetFamilyId: 'newFamily' }));
  }
});
test('version, unsafe paths and duplicate manifest entries fail closed', async () => {
  const fixture = await setup();
  for (const mutate of [
    m => { m.version = 999; }, m => { m.files[0].path = '../escape'; },
    m => { m.files[0].path = '/tmp/escape'; }, m => { m.files[0].path = 'originals/..'; },
    m => { m.files.push({ ...m.files[0] }); }
  ]) {
    const files = new Map(fixture.files);
    const manifest = JSON.parse(decoder.decode(files.get('manifest.json')));
    mutate(manifest); files.set('manifest.json', encode(manifest));
    await assert.rejects(inspectFamilyArchive({ ...fixture, files }));
  }
});
test('wrong source family and same-family restore never become implicit merge', async () => {
  const fixture = await setup();
  await assert.rejects(inspectFamilyArchive({ ...fixture, expectedFamilyId: 'otherFamily' }));
  await assert.rejects(prepareFamilyRestore({ ...fixture, targetFamilyId: fixture.expectedFamilyId }));
  await assert.rejects(prepareFamilyRestore({ ...fixture, targetFamilyId: '../escape' }));
  await assert.rejects(createFamilyArchive({ ...fixture, expectedFamilyId: 'otherFamily' }));
});
test('rehashing cannot conceal dangling people, memories, contributors or recording references', async () => {
  const fixture = await setup();
  for (const [path, mutate] of [
    ['data/memories.json', rows => { rows[0].personIds = ['missing']; return rows; }],
    ['data/stories.json', rows => { rows[0].memoryId = 'missing'; return rows; }],
    ['data/stories.json', rows => { rows[0].contributorId = 'missing'; return rows; }],
    ['data/stories.json', rows => { rows[0].recordingId = 'gardenPhoto'; return rows; }],
    ['data/stories.json', rows => { rows[0].recordingId = 'toneB'; return rows; }],
    ['data/memories.json', rows => { rows[0].originalIds = ['missing']; return rows; }]
  ]) {
    const files = new Map(fixture.files); await replace(files, path, mutate);
    await assert.rejects(inspectFamilyArchive({ ...fixture, files }));
  }
});
test('duplicate and cross-family record IDs are rejected even with valid inventory hashes', async () => {
  const fixture = await setup();
  for (const mutate of [
    rows => { rows.push({ ...rows[0] }); return rows; },
    rows => { rows[0].familyId = 'otherFamily'; return rows; }
  ]) {
    const files = new Map(fixture.files); await replace(files, 'data/people.json', mutate);
    await assert.rejects(inspectFamilyArchive({ ...fixture, files }));
  }
});
test('unsupported data is rejected, including credentials and unversioned metadata extensions', async () => {
  const fixture = await setup();
  for (const mutate of [
    c => { c.sessions = []; }, c => { c.family.token = 'fictional-secret'; },
    c => { c.contributors[0].accountId = 'account1'; }, c => { c.stories[0].notes = ['unsupported']; }
  ]) {
    const content = structuredClone(fixture.content); mutate(content);
    assert.throws(() => validateArchiveContent(content, fixture.expectedFamilyId));
  }
});
test('derivative bytes cannot substitute for originals even when manifest is rehashed', async () => {
  const fixture = await setup();
  const files = new Map(fixture.files);
  files.set('originals/gardenPhoto', encoder.encode('replaceable preview bytes'));
  const manifest = JSON.parse(decoder.decode(files.get('manifest.json')));
  const entry = manifest.files.find(x => x.path === 'originals/gardenPhoto');
  entry.byteLength = files.get(entry.path).length;
  entry.sha256 = Buffer.from(await webcrypto.subtle.digest('SHA-256', files.get(entry.path))).toString('hex');
  files.set('manifest.json', encode(manifest));
  await assert.rejects(inspectFamilyArchive({ ...fixture, files }));
});
test('inspection snapshots caller buffers before asynchronous hashing', async () => {
  const fixture = await setup();
  const pending = inspectFamilyArchive(fixture);
  fixture.files.get('originals/toneA').fill(0);
  const checked = await pending;
  assert.notEqual(checked.files.get('originals/toneA')[0], 0);
});
test('export refuses a missing or corrupt original and works without crypto only by rejecting', async () => {
  const fixture = await archiveFamilyFixture();
  await assert.rejects(createFamilyArchive({ ...fixture, store: { get: async () => null } }));
  await assert.rejects(createFamilyArchive({ ...fixture, subtleCrypto: null }));
});
