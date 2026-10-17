// Development-only directory transport for verified portable archives.
// Writes NEW directories only. Not an app database, installer or authorization layer.
import { constants } from 'node:fs';
import { open, lstat, readdir, realpath, mkdtemp, mkdir, rename, rm } from 'node:fs/promises';
import { resolve, dirname, basename, join } from 'node:path';
import { inspectFamilyArchive, createFamilyArchive, prepareFamilyRestore, ARCHIVE_LIMITS } from '../core/family-archive.mjs';
import { originalStorageKey } from '../core/original-storage.mjs';

async function missing(path) {
  try { await lstat(path); return false; }
  catch (error) { if (error.code === 'ENOENT') return true; throw error; }
}
async function plainDirectory(path) {
  const stat = await lstat(path);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('Archive directory required');
}
async function syncDirectory(path) {
  const handle = await open(path, 'r');
  try { await handle.sync(); } finally { await handle.close(); }
}
export async function readFamilyArchiveDirectory({ directory, expectedFamilyId, subtleCrypto }) {
  const root = resolve(directory);
  await plainDirectory(root);
  const files = new Map();
  let total = 0;
  const collect = async (path, relative) => {
    const stat = await lstat(path);
    if (!stat.isFile() || stat.isSymbolicLink() || files.size >= ARCHIVE_LIMITS.files ||
        total + stat.size > ARCHIVE_LIMITS.totalBytes) throw new Error('Unsafe or oversized archive entry');
    const limit = relative.startsWith('originals/') ? ARCHIVE_LIMITS.totalBytes : ARCHIVE_LIMITS.metadataBytes;
    if (stat.size > limit) throw new Error('Oversized archive entry');
    const handle = await open(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    try {
      // Bounded read detects truncation/growth instead of reading an unbounded file.
      const bytes = new Uint8Array(stat.size + 1);
      let offset = 0;
      while (offset < bytes.length) {
        const result = await handle.read(bytes, offset, bytes.length - offset, null);
        if (!result.bytesRead) break;
        offset += result.bytesRead;
      }
      if (offset !== stat.size) throw new Error('Archive changed while reading');
      total += offset;
      files.set(relative, bytes.slice(0, offset));
    } finally { await handle.close(); }
  };
  for (const entry of await readdir(root)) {
    if (entry === 'manifest.json') await collect(join(root, entry), entry);
    else if (entry === 'data' || entry === 'originals') {
      const folder = join(root, entry);
      await plainDirectory(folder);
      for (const leaf of await readdir(folder)) {
        if (!/^[A-Za-z0-9_.-]{1,100}$/.test(leaf)) throw new Error('Invalid archive entry');
        await collect(join(folder, leaf), entry + '/' + leaf);
      }
    } else throw new Error('Unexpected archive entry');
  }
  return (await inspectFamilyArchive({ files, expectedFamilyId, subtleCrypto })).files;
}
export async function writeFamilyArchiveDirectory({ files, destination, expectedFamilyId, subtleCrypto }) {
  const validated = await inspectFamilyArchive({ files, expectedFamilyId, subtleCrypto });
  const requested = resolve(destination);
  if (!/^[A-Za-z0-9_-]{1,80}$/.test(basename(requested))) throw new Error('Use a fresh named archive directory');
  // Parent must already exist; caller owns its trust/access boundary.
  const parent = await realpath(dirname(requested));
  const out = join(parent, basename(requested));
  if (!await missing(out)) throw new Error('Archive destination already exists');
  const stage = await mkdtemp(join(parent, '.archive-stage-'));
  try {
    const folders = new Set();
    for (const [path, bytes] of validated.files) {
      const folder = dirname(join(stage, path));
      await mkdir(folder, { recursive: true }); folders.add(folder);
      const handle = await open(join(stage, path), 'wx', 0o600);
      try { await handle.writeFile(bytes); await handle.sync(); } finally { await handle.close(); }
    }
    for (const folder of folders) await syncDirectory(folder);
    await syncDirectory(stage);
    await readFamilyArchiveDirectory({ directory: stage, expectedFamilyId, subtleCrypto });
    if (!await missing(out)) throw new Error('Archive destination appeared during write');
    await rename(stage, out);
  } catch (error) {
    await rm(stage, { recursive: true, force: true });
    throw error;
  }
  await syncDirectory(parent);
  return out;
}
export async function restoreFamilyArchiveDirectory({ files, expectedFamilyId, targetFamilyId, destination, subtleCrypto }) {
  const restored = await prepareFamilyRestore({ files, expectedFamilyId, targetFamilyId, subtleCrypto });
  const objects = new Map(restored.content.originals.map(original => [originalStorageKey(original), restored.originals.get(original.id)]));
  const targetFiles = await createFamilyArchive({ content: restored.content, expectedFamilyId: targetFamilyId,
    store: { get: async key => objects.get(key) ?? null }, subtleCrypto });
  const directory = await writeFamilyArchiveDirectory({ files: targetFiles, destination, expectedFamilyId: targetFamilyId, subtleCrypto });
  return { directory, access: restored.access, originals: restored.content.originals.length };
}
