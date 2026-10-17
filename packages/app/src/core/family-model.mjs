/**
 * G1 experimental portable model — no storage, identity, permissions or network.
 * Synthetic data only. This module is NOT an authorization boundary.
 * All identifiers are opaque family-local strings supplied by the caller.
 */
const isId = value => typeof value === "string" && /^[a-zA-Z0-9_-]{1,80}$/.test(value);
const requireId = (value, field) => {
  if (!isId(value)) throw new TypeError(`Invalid ${field}`);
  return value;
};
const optionalText = (value, field) => {
  if (value !== undefined && (typeof value !== "string" || value.length > 240)) {
    throw new TypeError(`Invalid ${field}`);
  }
  return value;
};

/** A family is a data boundary, not a user account. */
export function createFamily({ id, label }) {
  return Object.freeze({ id: requireId(id, "family id"), label: optionalText(label, "family label") ?? "" });
}

/** A person can be represented without ever having a login. */
export function createPerson({ id, familyId, displayName }) {
  return Object.freeze({
    id: requireId(id, "person id"),
    familyId: requireId(familyId, "family id"),
    displayName: optionalText(displayName, "display name") ?? ""
  });
}

/** Contributor attribution is distinct from the person a memory is about. */
export function createMemory({ id, familyId, personIds, title, contributorId }) {
  requireId(id, "memory id");
  requireId(familyId, "family id");
  requireId(contributorId, "contributor id");
  if (!Array.isArray(personIds) || personIds.length === 0 ||
      personIds.some(id => !isId(id)) || new Set(personIds).size !== personIds.length) {
    throw new TypeError("Memory requires distinct person IDs");
  }
  return Object.freeze({
    id, familyId, personIds: Object.freeze([...personIds]),
    title: optionalText(title, "title") ?? "", contributorId
  });
}

/**
 * Pure consistency check for caller-supplied objects.
 * This does not authenticate contributors or authorize any operation.
 */
export function validateMemoryReferences(memory, people) {
  if (!memory || !Array.isArray(people)) return false;
  const known = new Set(people.filter(person =>
    person && person.familyId === memory.familyId && isId(person.id)
  ).map(person => person.id));
  return Array.isArray(memory.personIds) && memory.personIds.length > 0 &&
    memory.personIds.every(id => known.has(id));
}

/** Longer contributions and transcripts must not inherit short-label limits. */
const storyText = value => {
  if (value === undefined) return "";
  if (typeof value !== "string" || value.length > 1000000) {
    throw new TypeError("Invalid story text");
  }
  return value;
};

/**
 * A story is one immutable contribution to a memory. Multiple people may
 * contribute separate stories without overwriting each other's versions.
 * This is metadata only: original audio/media bytes live in a separate
 * preservation layer that is not implemented here.
 * Contributor IDs are attribution references, never access grants.
 */
export function createStory({ id, familyId, memoryId, contributorId, text }) {
  return Object.freeze({
    id: requireId(id, "story id"),
    familyId: requireId(familyId, "family id"),
    memoryId: requireId(memoryId, "memory id"),
    contributorId: requireId(contributorId, "contributor id"),
    text: storyText(text)
  });
}

/** Referential consistency only. Does not verify identity or permissions. */
export function validateStoryReference(story, memory) {
  return Boolean(story && memory &&
    isId(story.id) && isId(story.memoryId) &&
    story.familyId === memory.familyId && story.memoryId === memory.id);
}

/**
 * Portable inventory record for one preserved original media object.
 * The caller must calculate the SHA-256 digest from actual bytes and verify
 * those bytes during export/restore. No filesystem, network, or storage here.
 * Opaque IDs prevent filenames, paths, or access URLs leaking into metadata.
 */
export function createMediaOriginal({ id, familyId, memoryId, contributorId, kind, byteLength, sha256 }) {
  if (!["photo", "audio", "video"].includes(kind)) throw new TypeError("Invalid media kind");
  if (!Number.isSafeInteger(byteLength) || byteLength < 0) throw new TypeError("Invalid byte length");
  if (typeof sha256 !== "string" || !/^[a-f0-9]{64}$/.test(sha256)) {
    throw new TypeError("Invalid SHA-256 digest");
  }
  return Object.freeze({
    id: requireId(id, "media id"),
    familyId: requireId(familyId, "family id"),
    memoryId: requireId(memoryId, "memory id"),
    contributorId: requireId(contributorId, "contributor id"),
    kind, byteLength, sha256
  });
}

/** A derivative references an original; it never replaces the original. */
export function createMediaDerivative({ id, originalId, familyId, variant }) {
  if (!["thumbnail", "preview", "playback"].includes(variant)) {
    throw new TypeError("Invalid derivative variant");
  }
  return Object.freeze({
    id: requireId(id, "derivative id"),
    originalId: requireId(originalId, "original id"),
    familyId: requireId(familyId, "family id"),
    variant
  });
}

/** Referential consistency only; NOT proof of bytes, storage, or access. */
export function validateMediaReferences(original, derivative, memory) {
  return Boolean(original && derivative && memory &&
    original.familyId === memory.familyId &&
    original.memoryId === memory.id &&
    derivative.familyId === original.familyId &&
    derivative.originalId === original.id &&
    derivative.id !== original.id);
}

/**
 * Verify caller-supplied original bytes against the immutable inventory.
 * Works with Uint8Array (including Node Buffer) and Web Crypto SubtleCrypto.
 * The crypto implementation is injected so the portable core has no runtime
 * or storage dependency. A missing crypto provider fails closed.
 * Does NOT read a file, persist it, authenticate anyone or grant access.
 */
export async function verifyMediaOriginalBytes(original, bytes, subtleCrypto) {
  if (!original || !(bytes instanceof Uint8Array) ||
      !Number.isSafeInteger(original.byteLength) ||
      original.byteLength !== bytes.byteLength ||
      typeof original.sha256 !== "string" ||
      !/^[a-f0-9]{64}$/.test(original.sha256) ||
      !subtleCrypto || typeof subtleCrypto.digest !== "function") {
    return false;
  }
  // Copy exactly the visible bytes; a sliced Buffer may have a larger backing
  // ArrayBuffer, which must never be included in the digest.
  const snapshot = Uint8Array.from(bytes);
  const digest = new Uint8Array(await subtleCrypto.digest("SHA-256", snapshot));
  if (digest.byteLength !== 32) return false;
  const expected = original.sha256;
  let mismatch = 0;
  for (let i = 0; i < 32; i++) {
    mismatch |= digest[i] ^ Number.parseInt(expected.slice(i * 2, i * 2 + 2), 16);
  }
  return mismatch === 0;
}

/**
 * Offline gallery projection for an explicitly selected person.
 * Caller supplies already-authorized data; this is NOT an access check.
 * Never use this selector to filter untrusted data before authorization.
 * Output contains no contributor accounts, tokens, paths or media URLs.
 */
export function selectPersonMemories(person, memories) {
  if (!person || !isId(person.id) || !isId(person.familyId) ||
      !Array.isArray(memories)) return Object.freeze([]);
  const selected = memories.filter(memory =>
    memory && memory.familyId === person.familyId &&
    Array.isArray(memory.personIds) && memory.personIds.includes(person.id) &&
    isId(memory.id)
  );
  return Object.freeze([...selected]);
}
