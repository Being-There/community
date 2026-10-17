import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readdir, readFile, writeFile, symlink, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { archiveFamilyFixture } from '../examples/archive-family.mjs';
import { createFamilyArchive, inspectFamilyArchive } from '../src/core/family-archive.mjs';
import { writeFamilyArchiveDirectory, readFamilyArchiveDirectory, restoreFamilyArchiveDirectory } from '../src/node/archive-directory.mjs';
async function setup(t) {
  const root = await mkdtemp(join(tmpdir(), 'being-there-recovery-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const fixture = await archiveFamilyFixture();
  const files = await createFamilyArchive(fixture);
  return { ...fixture, files, root };
}
test('exports to disk and restores to a new isolated directory with no reusable identity grants', async t => {
  const fixture = await setup(t);
  const source = join(fixture.root, 'source');
  await writeFamilyArchiveDirectory({ ...fixture, destination: source });
  const fromDisk = await readFamilyArchiveDirectory({ ...fixture, directory: source });
  const result = await restoreFamilyArchiveDirectory({ ...fixture, files: fromDisk, targetFamilyId: 'restoredFamily', destination: join(fixture.root, 'restored') });
  assert.equal(result.access.state, 'disabled');
  assert.equal(result.originals, 4);
  const restoredFiles = await readFamilyArchiveDirectory({ ...fixture, directory: result.directory, expectedFamilyId: 'restoredFamily' });
  const restored = await inspectFamilyArchive({ ...fixture, files: restoredFiles, expectedFamilyId: 'restoredFamily' });
  assert.equal(restored.content.stories.length, 2);
  assert.equal(restored.content.people.length, 2);
  assert.equal(restored.content.memories[1].hidden, true);
  for (const [path, bytes] of fixture.files) if (path.startsWith('originals/')) assert.deepEqual(restoredFiles.get(path), bytes);
  assert.deepEqual((await readdir(fixture.root)).sort(), ['restored', 'source']);
});
test('rejects corrupt disk originals before creating any restore destination', async t => {
  const fixture = await setup(t);
  const source = join(fixture.root, 'source');
  await writeFamilyArchiveDirectory({ ...fixture, destination: source });
  await writeFile(join(source, 'originals/toneA'), 'corrupt synthetic bytes');
  await assert.rejects(readFamilyArchiveDirectory({ ...fixture, directory: source }));
  const files = new Map(fixture.files); files.set('originals/toneA', new Uint8Array([1]));
  await assert.rejects(restoreFamilyArchiveDirectory({ ...fixture, files, targetFamilyId: 'restoredFamily', destination: join(fixture.root, 'restored') }));
  assert.deepEqual(await readdir(fixture.root), ['source']);
});
test('refuses existing destinations and preserves their bytes', async t => {
  const fixture = await setup(t);
  const destination = join(fixture.root, 'existing');
  await mkdir(destination); await writeFile(join(destination, 'keep'), 'prior original');
  await assert.rejects(restoreFamilyArchiveDirectory({ ...fixture, targetFamilyId: 'restoredFamily', destination }), /already exists/);
  assert.equal(await readFile(join(destination, 'keep'), 'utf8'), 'prior original');
  assert.deepEqual(await readdir(fixture.root), ['existing']);
});
test('rejects symlink originals and directory roots rather than following them', async t => {
  const fixture = await setup(t);
  const source = join(fixture.root, 'source');
  await writeFamilyArchiveDirectory({ ...fixture, destination: source });
  await symlink(source, join(fixture.root, 'alias'));
  await assert.rejects(readFamilyArchiveDirectory({ ...fixture, directory: join(fixture.root, 'alias') }), /directory required/);
  await rm(join(source, 'originals/toneA'));
  await symlink(join(source, 'originals/toneB'), join(source, 'originals/toneA'));
  await assert.rejects(readFamilyArchiveDirectory({ ...fixture, directory: source }), /Unsafe/);
});
test('wrong source family, unrelated data and unexpected disk files are rejected', async t => {
  const fixture = await setup(t);
  const source = join(fixture.root, 'source');
  await writeFamilyArchiveDirectory({ ...fixture, destination: source });
  await assert.rejects(readFamilyArchiveDirectory({ ...fixture, directory: source, expectedFamilyId: 'unrelatedFamily' }));
  await writeFile(join(source, 'sessions.json'), '{"unexpected":"fixture"}');
  await assert.rejects(readFamilyArchiveDirectory({ ...fixture, directory: source }), /Unexpected/);
});
