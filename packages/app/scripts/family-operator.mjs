// Operator-owned provisioning/recovery. Not exposed over HTTP.
import { readFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { webcrypto } from 'node:crypto';
import { openFamilyRepository } from '../src/server/sqlite-repository.mjs';
import { decodeArchiveFiles } from '../src/server/archive-transport.mjs';
import { readIndependentArchiveSnapshot } from '../src/server/independent-archive.mjs';
import { prepareFamilyRestore } from '../src/core/family-archive.mjs';
const [command, familyId, argument] = process.argv.slice(2);
if (!process.env.DATA_DIR || !['invite-organizer', 'restore', 'invite-recovery-organizer'].includes(command) || !familyId || !argument)
  throw new Error('Set private DATA_DIR, then: family-operator.mjs invite-organizer FAMILY_ID EMAIL | restore NEW_FAMILY_ID PRIVATE_EXPORT_JSON | invite-recovery-organizer FAMILY_ID EMAIL');
const repository = openFamilyRepository({ filename: join(resolve(process.env.DATA_DIR), 'family.sqlite') });
try {
  if (command === 'restore') {
    const stat = (await import('node:fs/promises')).stat;
    if ((await stat(argument)).size > 360 * 1024 * 1024) throw new Error('Archive too large');
    const value = JSON.parse(await readFile(argument, 'utf8'));
    const files = value.format === 'being-there.independent-originals' ? await readIndependentArchiveSnapshot(argument) : decodeArchiveFiles(value);
    const manifest = JSON.parse(new TextDecoder().decode(files.get('manifest.json')));
    const restored = await prepareFamilyRestore({ files, expectedFamilyId: manifest.familyId, targetFamilyId: familyId, subtleCrypto: webcrypto.subtle });
    repository.commitIsolatedRestore(restored);
    console.log('Restore committed. Identity access is disabled. Reverify organizer ownership before issuing a recovery invitation.');
  } else {
    if (!process.env.APP_ORIGIN || new URL(process.env.APP_ORIGIN).protocol !== 'https:') throw new Error('Configure the exact HTTPS APP_ORIGIN');
    const { token } = repository.bootstrapInvitation({ familyId, label: 'Family memories', email: argument, recovery: command === 'invite-recovery-organizer' });
    // Explicit operator output is the intended private share link. Never log it to CI.
    console.log(process.env.APP_ORIGIN + '/?invite=' + token);
  }
} finally { repository.close(); }
