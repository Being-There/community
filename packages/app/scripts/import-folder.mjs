// Explicit trusted-operator CLI. It does not expose an unauthenticated web import.
// Use a mounted/synced Google Drive directory, NAS share or normal folder.
import { stat } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { openFamilyRepository } from '../src/server/sqlite-repository.mjs';
import { importPhotoFolder } from '../src/server/folder-intake.mjs';

const [familyId, profileList, directory, ...extra] = process.argv.slice(2);
const dataDir = process.env.DATA_DIR;
if (!dataDir || !familyId || !profileList || !directory || extra.length)
  throw new Error('Set DATA_DIR, then run: npm run family:import -- FAMILY_ID PROFILE_ID[,PROFILE_ID...] /path/to/photos');
const dbPath = join(resolve(dataDir), 'family.sqlite');
if (!(await stat(dbPath)).isFile()) throw new Error('Existing family database required; do not create one by importing');
const repository = openFamilyRepository({ filename: dbPath, originalsDirectory: process.env.ORIGINALS_DIR });
try {
  const result = await importPhotoFolder({ repository, familyId, personIds: profileList.split(','), directory });
  // Never log photo filenames, personal names or contents.
  console.log(JSON.stringify(result));
  if (result.unsupported) console.log('Unsupported files were left untouched (only JPEG, PNG, WebP are supported).');
} finally { repository.close(); }
