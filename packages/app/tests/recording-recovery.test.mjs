import test from 'node:test';
import assert from 'node:assert/strict';
import { createRecordingRecovery } from '../src/core/recording-recovery.mjs';

// Minimal async IndexedDB test double, exercising the original transaction API.
function fakeIndexedDB() {
  const databases = new Map();
  return {
    open(name) {
      const request = {};
      queueMicrotask(() => {
        let data = databases.get(name);
        const fresh = !data;
        if (!data) { data = new Map(); databases.set(name, data); }
        const db = {
          objectStoreNames: { contains: () => !fresh || data.initialized === true },
          createObjectStore: () => { data.initialized = true; },
          transaction(_store, _mode) {
            const tx = { oncomplete: null, onerror: null, onabort: null,
              objectStore() {
                function run(fn) {
                  const req = {};
                  queueMicrotask(() => {
                    try { req.result = fn(); req.onsuccess?.(); queueMicrotask(() => tx.oncomplete?.()); }
                    catch (error) { req.error = error; req.onerror?.(); tx.onerror?.(); }
                  });
                  return req;
                }
                return {
                  put: item => run(() => { data.set(item.id, structuredClone(item)); return item.id; }),
                  getAll: () => run(() => [...data.values()].filter(x => typeof x === 'object').map(x => structuredClone(x))),
                  delete: id => run(() => { data.delete(id); })
                };
              }
            };
            return tx;
          },
          close() {}
        };
        request.result = db;
        if (fresh) request.onupgradeneeded?.();
        request.onsuccess?.();
      });
      return request;
    }
  };
}
test('preserves unfinished recording until explicit acknowledgment-driven removal', async () => {
  const idb = fakeIndexedDB();
  const recovery = createRecordingRecovery({ familyId: 'familyA', accountId: 'alice', indexedDB: idb });
  await recovery.saveRecording({ id: 'r1', blob: new Uint8Array([1, 2, 3]) });
  const afterReload = createRecordingRecovery({ familyId: 'familyA', accountId: 'alice', indexedDB: idb });
  assert.equal((await afterReload.pendingRecordings()).length, 1);
  await afterReload.removeRecording('r1');
  assert.deepEqual(await recovery.pendingRecordings(), []);
});
test('account and family switches use separate pending stores', async () => {
  const idb = fakeIndexedDB();
  const a = createRecordingRecovery({ familyId: 'familyA', accountId: 'alice', indexedDB: idb });
  const b = createRecordingRecovery({ familyId: 'familyB', accountId: 'alice', indexedDB: idb });
  const c = createRecordingRecovery({ familyId: 'familyA', accountId: 'bob', indexedDB: idb });
  await a.saveRecording({ id: 'r1', blob: 'fictional audio' });
  assert.deepEqual(await b.pendingRecordings(), []);
  assert.deepEqual(await c.pendingRecordings(), []);
  assert.equal((await a.pendingRecordings()).length, 1);
});
test('rejects unsafe family, account and recording identifiers', () => {
  const idb = fakeIndexedDB();
  assert.throws(() => createRecordingRecovery({ familyId: '../escape', accountId: 'alice', indexedDB: idb }));
  assert.throws(() => createRecordingRecovery({ familyId: 'familyA', accountId: '', indexedDB: idb }));
  const a = createRecordingRecovery({ familyId: 'familyA', accountId: 'alice', indexedDB: idb });
  assert.throws(() => a.saveRecording({ id: '../x' }));
  assert.throws(() => a.removeRecording('../x'));
});


test('hyphenated family and account tuples cannot collide', async () => {
  const idb = fakeIndexedDB();
  const a = createRecordingRecovery({ familyId: 'a-b', accountId: 'c', indexedDB: idb });
  const b = createRecordingRecovery({ familyId: 'a', accountId: 'b-c', indexedDB: idb });
  await a.saveRecording({ id: 'same', blob: 'family A original' });
  assert.deepEqual(await b.pendingRecordings(), []);
  await b.saveRecording({ id: 'same', blob: 'family B original' });
  await b.removeRecording('same');
  assert.equal((await a.pendingRecordings())[0].blob, 'family A original');
});
