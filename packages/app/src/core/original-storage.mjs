// Portable original-byte preservation contract. No identity or network endpoints.
// Storage adapters must implement put(key, bytes), get(key), delete(key).
// Caller must authorize family access before invoking this service.
import { verifyMediaOriginalBytes } from './family-model.mjs';

const id = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,80}$/.test(value);
export function originalStorageKey(original) {
  if (!original || !id(original.familyId) || !id(original.id))
    throw new TypeError('Valid original family and media IDs required');
  return `families/${original.familyId}/originals/${original.id}`;
}
export async function preserveOriginal({ original, bytes, store, subtleCrypto }) {
  if (!store || typeof store.put !== 'function' || typeof store.get !== 'function')
    throw new TypeError('Readable and writable storage adapter required');
  if (!await verifyMediaOriginalBytes(original, bytes, subtleCrypto))
    throw new Error('Original integrity verification failed');
  const key = originalStorageKey(original);
  const snapshot = Uint8Array.from(bytes);
  // Never overwrite a pre-existing original with different bytes.
  const existing = await store.get(key);
  if (existing !== null && existing !== undefined) {
    if (!await verifyMediaOriginalBytes(original, existing, subtleCrypto))
      throw new Error('Existing original conflicts with immutable inventory');
    return Object.freeze({ key, alreadyPresent: true });
  }
  await store.put(key, snapshot);
  const readback = await store.get(key);
  if (!await verifyMediaOriginalBytes(original, readback, subtleCrypto))
    throw new Error('Original storage readback failed integrity check');
  return Object.freeze({ key, alreadyPresent: false });
}
export async function recoverOriginal({ original, store, subtleCrypto }) {
  if (!store || typeof store.get !== 'function') throw new TypeError('Readable storage adapter required');
  const bytes = await store.get(originalStorageKey(original));
  if (!await verifyMediaOriginalBytes(original, bytes, subtleCrypto))
    throw new Error('Missing or corrupt original');
  return Uint8Array.from(bytes);
}
// Synthetic adapter only. Real adapters require atomic create-if-absent and
// durable write acknowledgment, especially for concurrent uploads.
export function createMemoryOriginalStore() {
  const objects = new Map();
  return Object.freeze({
    async put(key, bytes) { objects.set(key, Uint8Array.from(bytes)); },
    async get(key) { return objects.has(key) ? Uint8Array.from(objects.get(key)) : null; }
  });
}
