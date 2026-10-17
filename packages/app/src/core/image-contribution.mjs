// Synthetic, in-memory integration seam for original preservation and image renditions.
// NOT a server endpoint, durable archive, authentication or authorization implementation.
import { createMediaOriginal, verifyMediaOriginalBytes } from './family-model.mjs';
import { encodeImageRenditions } from './image-encoder.mjs';

export async function prepareImageContribution({
  id, familyId, memoryId, contributorId, bytes, mimeType, subtleCrypto, encodeDependencies
}) {
  if (!['image/jpeg', 'image/webp'].includes(mimeType))
    throw new TypeError('Supported image MIME type required');
  if (!(bytes instanceof Uint8Array) || bytes.byteLength === 0)
    throw new TypeError('Nonempty original image bytes required');
  if (!subtleCrypto || typeof subtleCrypto.digest !== 'function')
    throw new TypeError('Cryptographic hashing required');
  // Capture a snapshot so subsequent caller mutations cannot change the preserved input.
  const originalBytes = Uint8Array.from(bytes);
  const digest = new Uint8Array(await subtleCrypto.digest('SHA-256', originalBytes));
  if (digest.length !== 32) throw new Error('Invalid SHA-256 digest');
  const sha256 = [...digest].map(x => x.toString(16).padStart(2, '0')).join('');
  const original = createMediaOriginal({
    id, familyId, memoryId, contributorId, kind: 'photo',
    byteLength: originalBytes.byteLength, sha256
  });
  const verified = await verifyMediaOriginalBytes(original, originalBytes, subtleCrypto);
  if (!verified) throw new Error('Original integrity verification failed');
  // The caller must preserve the original in durable family-controlled storage
  // BEFORE publishing derivatives or acknowledging an upload.
  const derivatives = await encodeImageRenditions(
    new Blob([originalBytes], { type: mimeType }),
    encodeDependencies
  );
  return Object.freeze({ original, originalBytes, derivatives });
}
