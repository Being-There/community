// Bounded JSON transport around the existing portable archive format.
import { ARCHIVE_LIMITS } from '../core/family-archive.mjs';
export function encodeArchiveFiles(files) {
  return { format: 'being-there.archive-files', version: 1, files: [...files].map(([path, bytes]) => ({ path, base64: Buffer.from(bytes).toString('base64') })) };
}
export function decodeArchiveFiles(value) {
  if (!value || value.format !== 'being-there.archive-files' || value.version !== 1 ||
      Object.keys(value).some(key => !['format', 'version', 'files'].includes(key)) || !Array.isArray(value.files) || value.files.length > ARCHIVE_LIMITS.files) throw new Error('Invalid archive transport');
  const files = new Map(); let total = 0;
  for (const row of value.files) {
    if (!row || Object.keys(row).length !== 2 || typeof row.path !== 'string' || typeof row.base64 !== 'string' || files.has(row.path) || row.base64.length > Math.ceil(ARCHIVE_LIMITS.totalBytes / 3) * 4) throw new Error('Invalid archive transport');
    const bytes = Buffer.from(row.base64, 'base64'); total += bytes.length;
    if (total > ARCHIVE_LIMITS.totalBytes || bytes.toString('base64') !== row.base64) throw new Error('Invalid archive transport');
    files.set(row.path, Uint8Array.from(bytes));
  }
  return files;
}
