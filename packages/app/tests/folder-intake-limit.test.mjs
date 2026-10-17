import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { importPhotoFolder } from '../src/server/folder-intake.mjs';

test('nested directories do not consume the visible-file import budget', async () => {
  const root = await mkdtemp(join(tmpdir(), 'being-there-folder-limit-'));
  try {
    const nested = join(root, 'one', 'two', 'three');
    await mkdir(nested, { recursive: true });
    await writeFile(join(nested, 'first.txt'), 'unsupported fixture');
    await writeFile(join(nested, 'second.txt'), 'unsupported fixture');
    const repository = { importPhotoFromFolder() { throw new Error('unexpected photo import'); } };
    const result = await importPhotoFolder({
      directory: root, familyId: 'synthetic-family', personIds: ['synthetic-person'],
      repository, maxEntries: 2
    });
    assert.deepEqual(result, { imported: 0, alreadyPresent: 0, unsupported: 2 });
    await writeFile(join(nested, 'third.txt'), 'unsupported fixture');
    await assert.rejects(
      importPhotoFolder({ directory: root, familyId: 'synthetic-family',
        personIds: ['synthetic-person'], repository, maxEntries: 2 }),
      /Folder import limit reached/
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
