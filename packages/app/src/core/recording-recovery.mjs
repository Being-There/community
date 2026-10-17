// Adapted from the private reference application's recording-recovery module.
// Browser-local recovery only; NOT an authorization boundary.
// Never use this without server-side membership checks on upload/playback.
const STORE = 'pending';
const VERSION = 1;
const valid = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,80}$/.test(value);
export function createRecordingRecovery({ familyId, accountId, indexedDB: idb = globalThis.indexedDB }) {
  if (!valid(familyId) || !valid(accountId)) throw new TypeError('Valid family and account IDs required');
  if (!idb || typeof idb.open !== 'function') throw new TypeError('IndexedDB required');
  // Scoped per installation origin, family and authenticated account.
  // Opaque IDs only. Local browser users/scripts on the same origin can still inspect storage.
  // Length-independent tuple encoding prevents separator collisions.
  // v1 names were ambiguous: do not auto-import or delete their pending audio.
  const dbName = `being-there-recovery-v2-${JSON.stringify([familyId, accountId])}`;
  function database() {
    return new Promise((resolve, reject) => {
      const request = idb.open(dbName, VERSION);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE))
          request.result.createObjectStore(STORE, { keyPath: 'id' });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('Local recording storage unavailable'));
    });
  }
  async function transaction(mode, operation) {
    const db = await database();
    try {
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const request = operation(tx.objectStore(STORE));
        let result;
        request.onsuccess = () => { result = request.result; };
        request.onerror = () => reject(request.error || new Error('Recording operation failed'));
        tx.oncomplete = () => resolve(result);
        tx.onerror = () => reject(tx.error || new Error('Could not store recording'));
        tx.onabort = () => reject(tx.error || new Error('Recording storage interrupted'));
      });
    } finally { db.close(); }
  }
  function saveRecording(item) {
    if (!item || !valid(item.id)) throw new TypeError('Recording requires an opaque ID');
    return transaction('readwrite', store => store.put(item));
  }
  function pendingRecordings() { return transaction('readonly', store => store.getAll()); }
  // Caller MUST wait for verified durable server/archive acknowledgment.
  function removeRecording(id) {
    if (!valid(id)) throw new TypeError('Invalid recording ID');
    return transaction('readwrite', store => store.delete(id));
  }
  return Object.freeze({ saveRecording, pendingRecordings, removeRecording });
}

