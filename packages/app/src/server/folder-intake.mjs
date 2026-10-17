// Trusted local-folder intake for mounted Google Drive, NAS or ordinary folders.
// Runs through the operator CLI, NEVER a public HTTP route. No source deletion.
import { readdir, lstat, open } from 'node:fs/promises';
import { constants } from 'node:fs';
import { basename, extname, join, resolve } from 'node:path';
import { preparePhoto } from './photo-processing.mjs';

const extensions = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const maxPhotoBytes = 14 * 1024 * 1024;

async function* filesUnder(folder, limit) {
  let visited = 0;
  async function* walk(directory) {
    const entry = await lstat(directory);
    if (!entry.isDirectory() || entry.isSymbolicLink()) throw new Error('Folder must be a real directory');
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const item of entries) {
      // Hidden sync metadata and dot-directories are deliberately ignored;
      // they must not consume the bounded visible-file import budget.
      if (item.name.startsWith('.')) continue;
      const path = join(directory, item.name);
      if (item.isSymbolicLink()) throw new Error('Folder contains a symlink; refusing to follow it');
      if (item.isDirectory()) yield* walk(path);
      else if (item.isFile()) {
        if (++visited > limit) throw new Error('Folder import limit reached; use a smaller batch');
        yield path;
      }
      else throw new Error('Unexpected filesystem object in import folder');
    }
  }
  yield* walk(folder);
}

async function stableBytes(path) {
  // O_NOFOLLOW prevents a last-moment symlink replacement on Linux.
  const handle = await open(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
  try {
    const before = await handle.stat();
    if (!before.isFile() || before.size < 1 || before.size > maxPhotoBytes) throw new Error('Photo is empty or over 14 MiB');
    const bytes = await handle.readFile();
    const after = await handle.stat();
    if (before.dev !== after.dev || before.ino !== after.ino || before.size !== after.size ||
        before.mtimeMs !== after.mtimeMs || bytes.length !== before.size)
      throw new Error('Photo changed while reading; retry once it has finished syncing');
    return bytes;
  } finally { await handle.close(); }
}

export async function importPhotoFolder({ directory, familyId, personIds, repository, maxEntries = 10000 }) {
  if (!repository || typeof repository.importPhotoFromFolder !== 'function') throw new TypeError('Private family repository required');
  if (typeof directory !== 'string' || !directory.trim() || !Array.isArray(personIds) || !personIds.length)
    throw new TypeError('Folder and existing profile IDs are required');
  if (!Number.isSafeInteger(maxEntries) || maxEntries < 1 || maxEntries > 100000) throw new TypeError('Invalid file limit');
  const summary = { imported: 0, alreadyPresent: 0, unsupported: 0 };
  for await (const path of filesUnder(resolve(directory), maxEntries)) {
    const ext = extname(path).toLowerCase();
    if (!extensions.has(ext)) { summary.unsupported++; continue; }
    const original = await stableBytes(path);
    const photo = await preparePhoto(original);
    const title = basename(path, extname(path)).replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 240) || 'Photo';
    const result = repository.importPhotoFromFolder({ familyId, personIds, title, ...photo });
    if (!result.durable) throw new Error('Photo was not durably preserved');
    if (result.alreadyPresent) summary.alreadyPresent++;
    else summary.imported++;
  }
  return Object.freeze(summary);
}
