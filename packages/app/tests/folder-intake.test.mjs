import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile, symlink, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import sharp from 'sharp';
import { integratedFixture } from './helpers/integrated-app-fixture.mjs';
import { importPhotoFolder } from '../src/server/folder-intake.mjs';

const execute = promisify(execFile);
const json = async response => {
  const result = await response.json();
  assert.equal(response.status >= 200 && response.status < 300, true, result.error);
  return result;
};

async function household(t) {
  const fixture = await integratedFixture(t);
  const owner = await fixture.login('folder-test-owner', 'owner@family.example.test');
  assert.equal(owner.callback.status, 303);
  const invitation = fixture.repository.bootstrapInvitation({
    familyId: 'familyA', label: 'Imaginary household', email: 'owner@family.example.test'
  });
  await json(await owner.request('/api/invitations/accept', {
    method: 'POST', body: { token: invitation.token, displayName: 'Imaginary organizer' }
  }));
  await json(await owner.request('/api/families/familyA/people', {
    method: 'POST', body: { id: 'avery', displayName: 'Avery' }
  }));
  return { fixture, owner };
}
async function sampleImage(color) {
  return sharp({ create: { width: 32, height: 24, channels: 3, background: color } }).png().toBuffer();
}

test('ordinary nested folder imports into authorized gallery and independent originals', async t => {
  const { fixture, owner } = await household(t);
  const folder = join(fixture.directory, 'mounted-drive');
  await mkdir(join(folder, 'from-friends'), { recursive: true });
  const first = await sampleImage('#60866f');
  const second = await sampleImage('#b17b5c');
  await writeFile(join(folder, 'picnic.png'), first);
  await writeFile(join(folder, 'from-friends', 'lake.png'), second);
  await writeFile(join(folder, 'notes.txt'), 'This is not an image');
  const outcome = await importPhotoFolder({
    directory: folder, familyId: 'familyA', personIds: ['avery'], repository: fixture.repository
  });
  assert.deepEqual(outcome, { imported: 2, alreadyPresent: 0, unsupported: 1 });
  assert.deepEqual(await readFile(join(folder, 'picnic.png')), first, 'input originals stay untouched');
  assert.deepEqual(await readFile(join(folder, 'from-friends', 'lake.png')), second);
  const memories = fixture.repository.listMemories('familyA');
  assert.equal(memories.length, 2);
  assert.ok(memories.every(memory => memory.personIds.includes('avery') && memory.id.startsWith('ingest_')));
  assert.equal(fixture.repository.listContributors('familyA').some(row => row.displayName === 'Imported photos'), true);
  const byTitle = new Map(memories.map(memory => [memory.title, memory]));
  for (const [name, bytes] of [['picnic', first], ['lake', second]]) {
    const originalId = byTitle.get(name)?.originalIds[0];
    assert.ok(originalId);
    assert.deepEqual(Buffer.from(fixture.repository.getMediaBytes('familyA', originalId)), bytes);
    const response = await owner.request('/api/families/familyA/media/' + originalId);
    assert.equal(response.status, 200);
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), bytes);
    assert.ok(fixture.repository.getImageRenditions('familyA', originalId).length);
  }
  const snapshots = await readdir(join(fixture.directory, 'original-archive', 'familyA', 'snapshots'));
  assert.ok(snapshots.length >= 2, 'originals are preserved in independent metadata snapshots');
  const outsider = await fixture.login('folder-outsider', 'outsider@family.example.test');
  const denied = await outsider.request('/api/families/familyA/media/' + memories[0].originalIds[0]);
  assert.equal(denied.status, 404, 'filesystem imports do not bypass family API authorization');
  const repeat = await importPhotoFolder({
    directory: folder, familyId: 'familyA', personIds: ['avery'], repository: fixture.repository
  });
  assert.deepEqual(repeat, { imported: 0, alreadyPresent: 2, unsupported: 1 });
  assert.equal(fixture.repository.listMemories('familyA').length, 2);
  await json(await owner.request('/api/families/familyA/people', {
    method: 'POST', body: { id: 'riley', displayName: 'Riley' }
  }));
  await assert.rejects(importPhotoFolder({
    directory: folder, familyId: 'familyA', personIds: ['riley'], repository: fixture.repository
  }), error => error.status === 409, 'repeat input cannot silently replace the chosen profiles');
  fixture.reopen();
  assert.equal(fixture.repository.listMemories('familyA').length, 2, 'import survives database reopen');
});

test('CLI accepts a mounted folder and leaves source files intact', async t => {
  const { fixture } = await household(t);
  const folder = join(fixture.directory, 'share');
  await mkdir(folder);
  const original = await sampleImage('#7983b4');
  await writeFile(join(folder, 'sample.png'), original);
  const { stdout } = await execute(process.execPath,
    ['scripts/import-folder.mjs', 'familyA', 'avery', folder],
    { cwd: new URL('..', import.meta.url), env: { ...process.env, DATA_DIR: fixture.directory } });
  assert.deepEqual(JSON.parse(stdout.trim().split('\n')[0]),
    { imported: 1, alreadyPresent: 0, unsupported: 0 });
  assert.deepEqual(await readFile(join(folder, 'sample.png')), original);
  fixture.reopen();
  assert.equal(fixture.repository.listMemories('familyA').length, 1);
});

test('invalid files and missing profiles fail without importing anything', async t => {
  const { fixture } = await household(t);
  const folder = join(fixture.directory, 'invalid');
  await mkdir(folder);
  const original = await sampleImage('#557766');
  await writeFile(join(folder, 'photo.png'), original);
  await assert.rejects(importPhotoFolder({
    directory: folder, familyId: 'familyA', personIds: ['not-a-profile'], repository: fixture.repository
  }));
  assert.equal(fixture.repository.listMemories('familyA').length, 0);
  await writeFile(join(folder, 'photo.png'), Buffer.from('<svg onload="alert(1)"></svg>'));
  await assert.rejects(importPhotoFolder({
    directory: folder, familyId: 'familyA', personIds: ['avery'], repository: fixture.repository
  }));
  assert.equal(fixture.repository.listMemories('familyA').length, 0);
});

test('symlinks are never followed into source folders', async t => {
  if (process.platform === 'win32') return t.skip('Linux operator path hardening');
  const { fixture } = await household(t);
  const folder = join(fixture.directory, 'symlinked');
  await mkdir(folder);
  const target = join(fixture.directory, 'outside.png');
  await writeFile(target, await sampleImage('#aabbcc'));
  await symlink(target, join(folder, 'linked.png'));
  await assert.rejects(importPhotoFolder({
    directory: folder, familyId: 'familyA', personIds: ['avery'], repository: fixture.repository
  }), /symlink/i);
  assert.equal(fixture.repository.listMemories('familyA').length, 0);
});

test('hidden mounted-folder metadata does not exhaust the visible import limit', async t => {
  const { fixture } = await household(t);
  const folder = join(fixture.directory, 'synced-folder');
  await mkdir(join(folder, '.sync-state'), { recursive: true });
  for (let i = 0; i < 6; i++) {
    await writeFile(join(folder, '.sync-state', 'internal-' + i), 'ignored');
    await writeFile(join(folder, '.sync-' + i), 'ignored');
  }
  const original = await sampleImage('#75948c');
  await writeFile(join(folder, 'family-photo.png'), original);
  const result = await importPhotoFolder({
    directory: folder, familyId: 'familyA', personIds: ['avery'],
    repository: fixture.repository, maxEntries: 1
  });
  assert.deepEqual(result, { imported: 1, alreadyPresent: 0, unsupported: 0 });
  assert.deepEqual(await readFile(join(folder, 'family-photo.png')), original);
  assert.equal(fixture.repository.listMemories('familyA').length, 1);
  await writeFile(join(folder, 'second-photo.png'), await sampleImage('#917a66'));
  await assert.rejects(importPhotoFolder({
    directory: folder, familyId: 'familyA', personIds: ['avery'],
    repository: fixture.repository, maxEntries: 1
  }), /limit reached/);
  assert.equal(fixture.repository.listMemories('familyA').length, 1,
    'exceeding the visible limit does not create a second memory');
});

test('idempotent folder retry repairs an interrupted independent archive', async t => {
  const { fixture } = await household(t);
  const folder = join(fixture.directory, 'interrupted-import');
  await mkdir(folder);
  const original = await sampleImage('#73968b');
  await writeFile(join(folder, 'keepsake.png'), original);
  const input = { directory: folder, familyId: 'familyA', personIds: ['avery'], repository: fixture.repository };
  assert.deepEqual(await importPhotoFolder(input), { imported: 1, alreadyPresent: 0, unsupported: 0 });
  const memory = fixture.repository.listMemories('familyA')[0];
  const originalId = memory.originalIds[0];
  const archiveFile = join(fixture.directory, 'original-archive', 'familyA',
    'contributors', memory.contributorId, 'originals', originalId);
  const { unlink } = await import('node:fs/promises');
  await unlink(archiveFile); // Synthetic interrupted archive, never a source original.
  assert.deepEqual(await importPhotoFolder(input), { imported: 0, alreadyPresent: 1, unsupported: 0 });
  assert.deepEqual(await readFile(archiveFile), original, 'retry repairs exact original bytes');
  const { readIndependentArchiveSnapshot } = await import('../src/server/independent-archive.mjs');
  const { inspectFamilyArchive } = await import('../src/core/family-archive.mjs');
  const { webcrypto } = await import('node:crypto');
  const snapshots = await readdir(join(fixture.directory, 'original-archive', 'familyA', 'snapshots'));
  const latest = snapshots.sort().at(-1);
  const files = await readIndependentArchiveSnapshot(join(fixture.directory, 'original-archive', 'familyA', 'snapshots', latest));
  const inspected = await inspectFamilyArchive({ files, expectedFamilyId: 'familyA', subtleCrypto: webcrypto.subtle });
  assert.equal(inspected.content.memories.length, 1, 'repaired archive is independently readable');
  assert.equal(inspected.content.originals.length, 1, 'repaired archive includes exact original');

  assert.equal(fixture.repository.listMemories('familyA').length, 1, 'no duplicate memory');
  assert.deepEqual(await readFile(join(folder, 'keepsake.png')), original, 'source untouched');
});
