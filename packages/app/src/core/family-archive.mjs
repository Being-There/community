// Experimental portable content archive. No network, accounts or authorization.
// The caller must authorize export/restore; archive IDs never grant access.
import { createFamily, createPerson, createMemory, createStory, createMediaOriginal,
  validateMemoryReferences, validateStoryReference, verifyMediaOriginalBytes } from './family-model.mjs';
import { recoverOriginal } from './original-storage.mjs';

export const ARCHIVE_FORMAT = 'being-there.family-archive';
export const ARCHIVE_VERSION = 1;
export const ARCHIVE_LIMITS = Object.freeze({ files: 10010, metadataBytes: 8 * 1024 * 1024, totalBytes: 256 * 1024 * 1024 });
const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { fatal: true });
const id = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,80}$/.test(value);
const dataFiles = Object.freeze(['family', 'contributors', 'people', 'memories', 'stories', 'originals']);
const fail = () => { throw new TypeError('Invalid or unsupported family archive'); };
function fields(value, required, optional = []) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.keys(value).some(key => ![...required, ...optional].includes(key)) ||
      required.some(key => !Object.hasOwn(value, key))) fail();
}
function list(value) {
  if (!Array.isArray(value) || value.length > 10000) fail();
  return value;
}
function unique(records) {
  const ids = records.map(record => record.id);
  if (ids.some(value => !id(value)) || new Set(ids).size !== ids.length) fail();
}
function ids(value, { empty = true } = {}) {
  list(value);
  if ((!empty && value.length === 0) || value.some(value => !id(value)) || new Set(value).size !== value.length) fail();
  return [...value];
}
const jsonBytes = value => encoder.encode(JSON.stringify(value));
function parse(bytes) { try { return JSON.parse(decoder.decode(bytes)); } catch { fail(); } }
async function digest(bytes, subtleCrypto) {
  if (!subtleCrypto || typeof subtleCrypto.digest !== 'function') fail();
  const hash = new Uint8Array(await subtleCrypto.digest('SHA-256', bytes));
  if (hash.length !== 32) fail();
  return [...hash].map(byte => byte.toString(16).padStart(2, '0')).join('');
}
function deepFreeze(value) {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

// Reject unsupported fields instead of silently dropping notes, permissions or secrets.
// v1 covers the current core only; richer models need an explicit format migration.
export function validateArchiveContent(input, expectedFamilyId) {
  if (!id(expectedFamilyId)) fail();
  fields(input, dataFiles);
  fields(input.family, ['id', 'label']);
  const family = createFamily(input.family);
  if (family.id !== expectedFamilyId) fail();
  const inFamily = record => { if (record.familyId !== family.id) fail(); };
  const contributors = list(input.contributors).map(record => {
    fields(record, ['id', 'familyId', 'displayName']); inFamily(record);
    if (!id(record.id) || typeof record.displayName !== 'string' || record.displayName.length > 240) fail();
    return { ...record };
  });
  unique(contributors);
  const contributorIds = new Set(contributors.map(record => record.id));
  const credited = record => { if (!contributorIds.has(record.contributorId)) fail(); };
  const people = list(input.people).map(record => {
    fields(record, ['id', 'familyId', 'displayName']); inFamily(record);
    return createPerson(record);
  });
  unique(people);
  const memories = list(input.memories).map(record => {
    fields(record, ['id', 'familyId', 'personIds', 'title', 'contributorId', 'originalIds', 'hidden']);
    inFamily(record); credited(record);
    if (typeof record.hidden !== 'boolean') fail();
    const memory = createMemory(record);
    if (!validateMemoryReferences(memory, people)) fail();
    return { ...memory, originalIds: ids(record.originalIds), hidden: record.hidden };
  });
  unique(memories);
  const memoryById = new Map(memories.map(record => [record.id, record]));
  const originals = list(input.originals).map(record => {
    fields(record, ['id', 'familyId', 'memoryId', 'contributorId', 'kind', 'byteLength', 'sha256']);
    inFamily(record); credited(record);
    const original = createMediaOriginal(record);
    if (!memoryById.has(original.memoryId) || original.byteLength === 0) fail();
    return original;
  });
  unique(originals);
  const originalById = new Map(originals.map(record => [record.id, record]));
  const stories = list(input.stories).map(record => {
    fields(record, ['id', 'familyId', 'memoryId', 'contributorId', 'text', 'recordingId']);
    inFamily(record); credited(record);
    const story = createStory(record);
    if (!validateStoryReference(story, memoryById.get(story.memoryId))) fail();
    if (record.recordingId !== null) {
      const original = originalById.get(record.recordingId);
      if (!original || original.kind !== 'audio' || original.memoryId !== story.memoryId ||
          original.contributorId !== story.contributorId) fail();
    }
    return { ...story, recordingId: record.recordingId };
  });
  unique(stories);
  const attached = new Set();
  for (const memory of memories) for (const originalId of memory.originalIds) {
    if (originalById.get(originalId)?.memoryId !== memory.id) fail();
    attached.add(originalId);
  }
  for (const story of stories) if (story.recordingId !== null) attached.add(story.recordingId);
  if (originals.some(original => !attached.has(original.id))) fail();
  return deepFreeze({ family, contributors, people, memories, stories, originals });
}

export async function createFamilyArchive({ content, expectedFamilyId, store, subtleCrypto }) {
  // Validate synchronously before awaiting storage to prevent caller mutation.
  const snapshot = validateArchiveContent(content, expectedFamilyId);
  const files = new Map();
  let total = 0;
  function add(path, bytes) {
    total += bytes.byteLength;
    if (total > ARCHIVE_LIMITS.totalBytes || files.size >= ARCHIVE_LIMITS.files) fail();
    files.set(path, bytes);
  }
  for (const name of dataFiles) {
    const bytes = jsonBytes(snapshot[name]);
    if (bytes.length > ARCHIVE_LIMITS.metadataBytes) fail();
    add('data/' + name + '.json', bytes);
  }
  for (const original of snapshot.originals) {
    if (total + original.byteLength > ARCHIVE_LIMITS.totalBytes) fail();
    const bytes = await recoverOriginal({ original, store, subtleCrypto });
    if (!await verifyMediaOriginalBytes(original, bytes, subtleCrypto)) fail();
    add('originals/' + original.id, bytes);
  }
  const inventory = [];
  for (const [path, bytes] of files)
    inventory.push({ path, byteLength: bytes.length, sha256: await digest(bytes, subtleCrypto) });
  add('manifest.json', jsonBytes({ format: ARCHIVE_FORMAT, version: ARCHIVE_VERSION, familyId: expectedFamilyId, files: inventory }));
  return files;
}

export async function inspectFamilyArchive({ files, expectedFamilyId, subtleCrypto }) {
  if (!(files instanceof Map) || files.size > ARCHIVE_LIMITS.files || !id(expectedFamilyId)) fail();
  // Snapshot every visible byte before any await, including Buffer subarrays.
  const snapshot = new Map();
  let total = 0;
  for (const [path, bytes] of files) {
    if (typeof path !== 'string' || !(bytes instanceof Uint8Array)) fail();
    total += bytes.byteLength;
    if (total > ARCHIVE_LIMITS.totalBytes) fail();
    snapshot.set(path, Uint8Array.from(bytes));
  }
  const manifestBytes = snapshot.get('manifest.json');
  if (!manifestBytes || manifestBytes.length > ARCHIVE_LIMITS.metadataBytes) fail();
  const manifest = parse(manifestBytes);
  fields(manifest, ['format', 'version', 'familyId', 'files']);
  if (manifest.format !== ARCHIVE_FORMAT || manifest.version !== ARCHIVE_VERSION || manifest.familyId !== expectedFamilyId) fail();
  if (!Array.isArray(manifest.files) || manifest.files.length >= ARCHIVE_LIMITS.files) fail();
  const seen = new Set();
  for (const entry of manifest.files) {
    fields(entry, ['path', 'byteLength', 'sha256']);
    if (typeof entry.path !== 'string' || seen.has(entry.path) ||
        !/^(?:data\/(?:family|contributors|people|memories|stories|originals)\.json|originals\/[A-Za-z0-9_-]{1,80})$/.test(entry.path) ||
        !Number.isSafeInteger(entry.byteLength) || entry.byteLength < 0 ||
        typeof entry.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(entry.sha256)) fail();
    const bytes = snapshot.get(entry.path);
    if (!bytes || bytes.length !== entry.byteLength || await digest(bytes, subtleCrypto) !== entry.sha256) fail();
    seen.add(entry.path);
  }
  if (snapshot.size !== seen.size + 1) fail();
  const content = {};
  for (const name of dataFiles) {
    const bytes = snapshot.get('data/' + name + '.json');
    if (!seen.has('data/' + name + '.json') || bytes.length > ARCHIVE_LIMITS.metadataBytes) fail();
    content[name] = parse(bytes);
  }
  const validated = validateArchiveContent(content, expectedFamilyId);
  if (seen.size !== dataFiles.length + validated.originals.length) fail();
  for (const original of validated.originals) {
    const bytes = snapshot.get('originals/' + original.id);
    if (!seen.has('originals/' + original.id) || !await verifyMediaOriginalBytes(original, bytes, subtleCrypto)) fail();
  }
  return { content: validated, files: snapshot };
}

// Pure preparation only. A destination must atomically commit into a NEW family,
// and must separately verify identities. No memberships, invites or sessions exist here.
export async function prepareFamilyRestore({ files, expectedFamilyId, targetFamilyId, subtleCrypto }) {
  if (!id(targetFamilyId) || targetFamilyId === expectedFamilyId) fail();
  const { content, files: snapshot } = await inspectFamilyArchive({ files, expectedFamilyId, subtleCrypto });
  const restored = validateArchiveContent({
    family: { ...content.family, id: targetFamilyId },
    ...Object.fromEntries(dataFiles.filter(name => name !== 'family').map(name => [name,
      content[name].map(record => ({ ...record, familyId: targetFamilyId }))]))
  }, targetFamilyId);
  const originals = new Map(restored.originals.map(original => [original.id, Uint8Array.from(snapshot.get('originals/' + original.id))]));
  return { content: restored, originals, access: Object.freeze({ state: 'disabled', memberships: Object.freeze([]), invitations: Object.freeze([]), sessions: Object.freeze([]) }) };
}
