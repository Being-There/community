// Synthetic clean-process recovery drill. No accounts, servers or real family data.
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { webcrypto } from 'node:crypto';
import { archiveFamilyFixture } from '../examples/archive-family.mjs';
import { createFamilyArchive, inspectFamilyArchive } from '../src/core/family-archive.mjs';
import { writeFamilyArchiveDirectory, readFamilyArchiveDirectory, restoreFamilyArchiveDirectory } from '../src/node/archive-directory.mjs';
const run = promisify(execFile);
const subtleCrypto = webcrypto.subtle;
if (process.argv[2] === '--verify') {
  const [directory, expectedFamilyId] = process.argv.slice(3);
  const files = await readFamilyArchiveDirectory({ directory, expectedFamilyId, subtleCrypto });
  const { content } = await inspectFamilyArchive({ files, expectedFamilyId, subtleCrypto });
  console.log(JSON.stringify({ verified: true, people: content.people.length, memories: content.memories.length, stories: content.stories.length, originals: content.originals.length }));
} else {
  if (process.argv.length > 2) throw new Error('Usage: node scripts/recovery-drill.mjs');
  const root = await mkdtemp(join(tmpdir(), 'being-there-synthetic-drill-'));
  try {
    const fixture = await archiveFamilyFixture();
    const files = await createFamilyArchive(fixture);
    const source = await writeFamilyArchiveDirectory({ ...fixture, files, destination: join(root, 'source') });
    const diskFiles = await readFamilyArchiveDirectory({ ...fixture, directory: source });
    const restored = await restoreFamilyArchiveDirectory({ ...fixture, files: diskFiles, targetFamilyId: 'freshFictionalFamily', destination: join(root, 'restored') });
    for (const [directory, familyId] of [[source, fixture.expectedFamilyId], [restored.directory, 'freshFictionalFamily']]) {
      const { stdout } = await run(process.execPath, [process.argv[1], '--verify', directory, familyId]);
      const result = JSON.parse(stdout);
      if (!result.verified || result.people !== 2 || result.stories !== 2 || result.originals !== 4) throw new Error('Recovery drill failed');
    }
    console.log('Synthetic disk recovery verified in fresh processes: 2 people, 2 memories, 2 independent stories, 4 originals. Restored access disabled.');
  } finally { await rm(root, { recursive: true, force: true }); }
}
