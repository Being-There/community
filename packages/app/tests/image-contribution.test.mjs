import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { prepareImageContribution } from '../src/core/image-contribution.mjs';
import { verifyMediaOriginalBytes } from '../src/core/family-model.mjs';

test('connects original checksum to three image renditions without altering bytes', async () => {
  const input = new Uint8Array([255, 216, 255, 217]);
  let seenBlob;
  const dependencies = {
    createObjectURL: blob => { seenBlob = blob; return 'blob:fictional'; },
    revokeObjectURL() {},
    createImage: () => ({ naturalWidth: 100, naturalHeight: 50, decode: async () => {}, src: '' }),
    createCanvas: () => ({
      width: 0, height: 0,
      getContext: () => ({ fillRect() {}, drawImage() {} }),
      toBlob: callback => callback({ type: 'image/webp', size: 50 })
    })
  };
  const result = await prepareImageContribution({
    id: 'photo1', familyId: 'family1', memoryId: 'memory1',
    contributorId: 'contributor1', bytes: input, mimeType: 'image/jpeg',
    subtleCrypto: webcrypto.subtle, encodeDependencies: dependencies
  });
  assert.equal(result.original.byteLength, 4);
  assert.equal(result.original.kind, 'photo');
  assert.deepEqual(Object.keys(result.derivatives), ['small', 'medium', 'large']);
  assert.equal(seenBlob.type, 'image/jpeg');
  assert.deepEqual(new Uint8Array(await seenBlob.arrayBuffer()), input);
  assert.equal(await verifyMediaOriginalBytes(result.original, result.originalBytes, webcrypto.subtle), true);
  input[0] = 0;
  assert.equal(result.originalBytes[0], 255);
  assert.equal(await verifyMediaOriginalBytes(result.original, input, webcrypto.subtle), false);
});
test('rejects missing bytes and unsupported MIME types', async () => {
  const base = { id: 'p', familyId: 'f', memoryId: 'm', contributorId: 'c', subtleCrypto: webcrypto.subtle };
  await assert.rejects(prepareImageContribution({ ...base, bytes: new Uint8Array(), mimeType: 'image/jpeg' }), TypeError);
  await assert.rejects(prepareImageContribution({ ...base, bytes: new Uint8Array([1]), mimeType: 'image/png' }), TypeError);
});
