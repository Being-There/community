// Plain originals and versioned content snapshots outside the application DB.
// Trusted private directory; no credentials, accounts or live access grants.
import { mkdirSync, lstatSync, readFileSync, openSync, writeFileSync, closeSync, fsyncSync, linkSync, unlinkSync } from 'node:fs';
import { join, resolve, dirname, basename } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { webcrypto } from 'node:crypto';
import { createFamilyArchive } from '../core/family-archive.mjs';
import { validateArchiveContent } from '../core/family-archive.mjs';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
function directory(path) { mkdirSync(path, { recursive: true, mode: 0o700 }); const stat = lstatSync(path); if (!stat.isDirectory() || stat.isSymbolicLink() || (stat.mode & 0o077)) throw new Error('Private archive directory required'); }
function sync(path) { const fd = openSync(path, 'r'); try { fsyncSync(fd); } finally { closeSync(fd); } }
function immutable(path, bytes) {
  try { const stat = lstatSync(path); if (!stat.isFile() || stat.isSymbolicLink() || sha(readFileSync(path)) !== sha(bytes)) throw new Error('Conflicting independent original'); return; }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const temp = path + '.pending-' + randomUUID(); const fd = openSync(temp, 'wx', 0o600);
  try { writeFileSync(fd, bytes); fsyncSync(fd); } finally { closeSync(fd); }
  try { try { linkSync(temp, path); } catch (error) { if (error.code !== 'EEXIST') throw error; } if (!lstatSync(path).isFile() || lstatSync(path).isSymbolicLink() || sha(readFileSync(path)) !== sha(bytes)) throw new Error('Independent original readback failed'); } finally { unlinkSync(temp); }
}
export function createIndependentArchive(root) {
  root = resolve(root); directory(root);
  return function preserve(content, readOriginal, sequence) {
    const checked = validateArchiveContent(content, content.family.id);
    const family = join(root, checked.family.id); directory(family);
    for (const original of checked.originals) {
      const folder = join(family, 'contributors', original.contributorId, 'originals'); directory(folder);
      const bytes = readOriginal(original.id);
      if (!(bytes instanceof Uint8Array) || bytes.length !== original.byteLength || sha(bytes) !== original.sha256) throw new Error('Original archive integrity failure');
      immutable(join(folder, original.id), bytes); sync(folder); sync(dirname(folder)); sync(dirname(dirname(folder)));
    }
    const snapshots = join(family, 'snapshots'); directory(snapshots);
    if (!Number.isSafeInteger(sequence) || sequence < 1) throw new Error('Archive sequence required');
    const snapshot = join(snapshots, String(sequence).padStart(16, '0') + '-' + randomUUID() + '.json');
    immutable(snapshot, Buffer.from(JSON.stringify({ format: 'being-there.independent-originals', version: 1, sequence, createdAt: new Date().toISOString(), content: checked })));
    sync(snapshots); sync(family); sync(root);
    return snapshot;
  };
}

export async function readIndependentArchiveSnapshot(filename) {
  const path = resolve(filename);
  if (!lstatSync(path).isFile() || lstatSync(path).isSymbolicLink() || basename(dirname(path)) !== 'snapshots') throw new Error('Regular private archive snapshot required');
  const envelope = JSON.parse(readFileSync(path, 'utf8'));
  if (envelope.format !== 'being-there.independent-originals' || envelope.version !== 1) throw new Error('Unsupported independent archive');
  const content = validateArchiveContent(envelope.content, envelope.content?.family?.id);
  const family = dirname(dirname(path));
  if (basename(family) !== content.family.id) throw new Error('Archive family path mismatch');
  const byId = new Map(content.originals.map(row => [row.id, row]));
  return createFamilyArchive({ content, expectedFamilyId: content.family.id, subtleCrypto: webcrypto.subtle, store: { get: async key => {
    const parts = key.split('/'); if (parts.length !== 4 || parts[0] !== 'families' || parts[1] !== content.family.id || parts[2] !== 'originals') return null;
    const original = byId.get(parts[3]); if (!original) return null;
    const file = join(family, 'contributors', original.contributorId, 'originals', original.id);
    const stat = lstatSync(file); if (!stat.isFile() || stat.isSymbolicLink() || stat.size !== original.byteLength) throw new Error('Missing or unsafe independent original');
    return Uint8Array.from(readFileSync(file));
  } } });
}
