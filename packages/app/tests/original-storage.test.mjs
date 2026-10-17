import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { createMediaOriginal } from '../src/core/family-model.mjs';
import { createMemoryOriginalStore, originalStorageKey, preserveOriginal, recoverOriginal } from '../src/core/original-storage.mjs';

async function fixture(familyId, bytes) {
  const digest = new Uint8Array(await webcrypto.subtle.digest('SHA-256', bytes));
  return createMediaOriginal({
    id: 'photo1', familyId, memoryId: 'memory1', contributorId: 'contributor1',
    kind: 'photo', byteLength: bytes.length,
    sha256: [...digest].map(x => x.toString(16).padStart(2, '0')).join('')
  });
}
test('preserves immutable original and verifies readback', async () => {
  const bytes = new Uint8Array([1, 2, 3]);
  const original = await fixture('familyA', bytes);
  const store = createMemoryOriginalStore();
  assert.deepEqual(await preserveOriginal({ original, bytes, store, subtleCrypto: webcrypto.subtle }),
    { key: 'families/familyA/originals/photo1', alreadyPresent: false });
  bytes[0] = 99;
  assert.deepEqual(await recoverOriginal({ original, store, subtleCrypto: webcrypto.subtle }), new Uint8Array([1, 2, 3]));
  assert.equal((await preserveOriginal({ original, bytes: new Uint8Array([1, 2, 3]), store, subtleCrypto: webcrypto.subtle })).alreadyPresent, true);
});
test('partitions storage keys by family and rejects wrong bytes', async () => {
  const store = createMemoryOriginalStore();
  const a = await fixture('familyA', new Uint8Array([1]));
  const b = await fixture('familyB', new Uint8Array([2]));
  assert.notEqual(originalStorageKey(a), originalStorageKey(b));
  await preserveOriginal({ original: a, bytes: new Uint8Array([1]), store, subtleCrypto: webcrypto.subtle });
  await assert.rejects(recoverOriginal({ original: b, store, subtleCrypto: webcrypto.subtle }), /Missing or corrupt/);
  await assert.rejects(preserveOriginal({ original: a, bytes: new Uint8Array([2]), store, subtleCrypto: webcrypto.subtle }), /integrity/);
});
test('detects corruption and refuses conflicting stored original', async () => {
  const store = createMemoryOriginalStore();
  const original = await fixture('familyA', new Uint8Array([1, 2]));
  await store.put(originalStorageKey(original), new Uint8Array([3, 4]));
  await assert.rejects(preserveOriginal({ original, bytes: new Uint8Array([1, 2]), store, subtleCrypto: webcrypto.subtle }), /conflicts/);
  await assert.rejects(recoverOriginal({ original, store, subtleCrypto: webcrypto.subtle }), /corrupt/);
});
