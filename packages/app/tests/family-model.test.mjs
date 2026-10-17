import test from "node:test";
import assert from "node:assert/strict";
import { webcrypto } from "node:crypto";
import {
  createFamily, createPerson, createMemory, validateMemoryReferences,
  createStory, validateStoryReference,
  createMediaOriginal, createMediaDerivative, validateMediaReferences,
  verifyMediaOriginalBytes
} from "../src/core/family-model.mjs";

test("multiple people belong to one family without account fields", () => {
  const family = createFamily({ id: "family_1", label: "Sample Household" });
  const avery = createPerson({ id: "avery", familyId: family.id, displayName: "Avery" });
  const riley = createPerson({ id: "riley", familyId: family.id, displayName: "Riley" });
  assert.equal(family.id, avery.familyId);
  assert.equal(riley.familyId, avery.familyId);
  assert.equal(Object.hasOwn(avery, "accountId"), false);
  assert.equal(Object.hasOwn(riley, "login"), false);
  assert.ok(Object.isFrozen(avery));
});

test("one memory can reference two people; contributor remains separate", () => {
  const people = [
    createPerson({ id: "avery", familyId: "f1", displayName: "Avery" }),
    createPerson({ id: "riley", familyId: "f1", displayName: "Riley" })
  ];
  const memory = createMemory({
    id: "picnic", familyId: "f1", personIds: ["avery", "riley"],
    title: "Picnic", contributorId: "casey"
  });
  assert.equal(memory.contributorId, "casey");
  assert.deepEqual(memory.personIds, ["avery", "riley"]);
  assert.equal(validateMemoryReferences(memory, people), true);
  assert.ok(Object.isFrozen(memory.personIds));
});

test("shared memories need no named person and story speaker is independent of contributor", () => {
  const memory = createMemory({ id: "shared", familyId: "family1", personIds: [], title: "Sunset", contributorId: "member1" });
  assert.equal(validateMemoryReferences(memory, []), true);
  const story = createStory({ id: "s", familyId: "family1", memoryId: "shared", contributorId: "member1", speakerPersonId: "avery", text: "I remember that." });
  assert.equal(story.speakerPersonId, "avery");
  assert.equal(story.contributorId, "member1");
  assert.throws(() => createStory({ id: "s", familyId: "family1", memoryId: "shared", contributorId: "member1", speakerPersonId: "../bad" }), TypeError);
});

test("a person from another family cannot satisfy a memory reference", () => {
  const memory = createMemory({
    id: "memory1", familyId: "f1", personIds: ["avery", "riley"],
    contributorId: "casey"
  });
  const people = [
    createPerson({ id: "avery", familyId: "f1" }),
    createPerson({ id: "riley", familyId: "f2" })
  ];
  assert.equal(validateMemoryReferences(memory, people), false);
  assert.equal(validateMemoryReferences(memory, [people[0]]), false);
  assert.equal(validateMemoryReferences(memory, []), false);
  assert.equal(validateMemoryReferences(null, people), false);
});

test("reject invalid, missing, duplicate and unsafe identifiers", () => {
  assert.throws(() => createFamily({ id: "../outside" }), TypeError);
  assert.throws(() => createPerson({ id: "", familyId: "f1" }), TypeError);
  assert.throws(() => createPerson({ id: "person", familyId: "f1", displayName: 123 }), TypeError);
  assert.deepEqual(createMemory({ id: "m", familyId: "f1", contributorId: "c", personIds: [] }).personIds, []);
  assert.throws(() => createMemory({ id: "m", familyId: "f1", contributorId: "c" }), TypeError);
  assert.throws(() => createMemory({ id: "m", familyId: "f1", contributorId: "c", personIds: ["a", "a"] }), TypeError);
  assert.throws(() => createMemory({ id: "m", familyId: "f1", contributorId: "c", personIds: ["a", "../b"] }), TypeError);
  assert.throws(() => createMemory({ id: "m", familyId: "f1", contributorId: "c", personIds: ["a"], title: "x".repeat(241) }), TypeError);
});

test("model objects are immutable snapshots without external dependencies", () => {
  const ids = ["avery"];
  const memory = createMemory({ id: "m", familyId: "f1", contributorId: "c", personIds: ids });
  ids.push("riley");
  assert.deepEqual(memory.personIds, ["avery"]);
  assert.ok(Object.isFrozen(memory));
  assert.equal(typeof createFamily, "function");
});

test("person profiles and memory references never contain access grants", () => {
  const profile = createPerson({ id: "avery", familyId: "f1", displayName: "Avery" });
  const memory = createMemory({
    id: "garden", familyId: "f1", personIds: ["avery"], contributorId: "casey"
  });
  for (const record of [profile, memory]) {
    for (const field of ["session", "token", "invite", "invitation", "membership", "role", "canView", "accountId"]) {
      assert.equal(Object.hasOwn(record, field), false, `Unexpected access field: ${field}`);
    }
  }
  assert.equal(validateMemoryReferences(memory, [profile]), true,
    "Referential validity is not authorization");
  // No authenticated endpoints exist in G1; endpoint-level denial tests remain mandatory.
});

test("two fictional contributors retain independent stories on one memory", () => {
  const memory = createMemory({
    id: "picnic", familyId: "family1", personIds: ["avery"],
    contributorId: "morgan", title: "Picnic"
  });
  const first = createStory({
    id: "story1", familyId: "family1", memoryId: "picnic",
    contributorId: "morgan", text: "We packed sandwiches."
  });
  const second = createStory({
    id: "story2", familyId: "family1", memoryId: "picnic",
    contributorId: "casey", text: "I remember the kite."
  });
  assert.equal(validateStoryReference(first, memory), true);
  assert.equal(validateStoryReference(second, memory), true);
  assert.notEqual(first.contributorId, second.contributorId);
  assert.notEqual(first.text, second.text);
  assert.ok(Object.isFrozen(first));
  assert.ok(Object.isFrozen(second));
  assert.equal(Object.hasOwn(first, "canView"), false);
  assert.equal(Object.hasOwn(first, "membership"), false);
});

test("story references cannot cross family or memory boundaries", () => {
  const memory = createMemory({
    id: "picnic", familyId: "family1", personIds: ["avery"], contributorId: "morgan"
  });
  const wrongFamily = createStory({
    id: "s1", familyId: "family2", memoryId: "picnic", contributorId: "casey"
  });
  const wrongMemory = createStory({
    id: "s2", familyId: "family1", memoryId: "other", contributorId: "casey"
  });
  assert.equal(validateStoryReference(wrongFamily, memory), false);
  assert.equal(validateStoryReference(wrongMemory, memory), false);
  assert.equal(validateStoryReference(null, memory), false);
  assert.equal(validateStoryReference(wrongFamily, null), false);
});

test("story input validation rejects unsafe IDs and oversized text", () => {
  const base = { id: "s1", familyId: "family1", memoryId: "picnic", contributorId: "casey" };
  assert.throws(() => createStory({ ...base, id: "../escape" }), TypeError);
  assert.throws(() => createStory({ ...base, contributorId: "" }), TypeError);
  assert.throws(() => createStory({ ...base, text: 42 }), TypeError);
  assert.equal(createStory({ ...base, text: "x".repeat(10000) }).text.length, 10000);
  assert.throws(() => createStory({ ...base, text: "x".repeat(1000001) }), TypeError);
});

test("preserved original and derived preview remain separate immutable records", () => {
  const memory = createMemory({
    id: "picnic", familyId: "family1", personIds: ["avery"], contributorId: "casey"
  });
  const original = createMediaOriginal({
    id: "original1", familyId: "family1", memoryId: "picnic",
    contributorId: "casey", kind: "photo", byteLength: 1024, sha256: "a".repeat(64)
  });
  const preview = createMediaDerivative({
    id: "preview1", originalId: "original1", familyId: "family1", variant: "preview"
  });
  assert.equal(validateMediaReferences(original, preview, memory), true);
  assert.equal(original.sha256, "a".repeat(64));
  assert.equal(preview.originalId, original.id);
  assert.ok(Object.isFrozen(original));
  assert.ok(Object.isFrozen(preview));
  for (const record of [original, preview]) {
    for (const key of ["url", "path", "token", "membership", "canView"]) {
      assert.equal(Object.hasOwn(record, key), false);
    }
  }
});

test("media references reject cross-family, cross-original and same-ID derivatives", () => {
  const memory = createMemory({
    id: "picnic", familyId: "family1", personIds: ["avery"], contributorId: "casey"
  });
  const original = createMediaOriginal({
    id: "original1", familyId: "family1", memoryId: "picnic",
    contributorId: "casey", kind: "audio", byteLength: 0, sha256: "b".repeat(64)
  });
  const derivative = createMediaDerivative({
    id: "preview1", originalId: "original1", familyId: "family2", variant: "playback"
  });
  assert.equal(validateMediaReferences(original, derivative, memory), false);
  assert.equal(validateMediaReferences(original, { ...derivative, familyId: "family1", originalId: "other" }, memory), false);
  assert.equal(validateMediaReferences(original, { ...derivative, familyId: "family1", id: "original1" }, memory), false);
  assert.equal(validateMediaReferences(original, derivative, null), false);
});

test("media manifest rejects invalid hashes, sizes, variants and unsafe IDs", () => {
  const base = {
    id: "original1", familyId: "family1", memoryId: "picnic",
    contributorId: "casey", kind: "photo", byteLength: 10, sha256: "c".repeat(64)
  };
  assert.throws(() => createMediaOriginal({ ...base, sha256: "abc" }), TypeError);
  assert.throws(() => createMediaOriginal({ ...base, sha256: "C".repeat(64) }), TypeError);
  assert.throws(() => createMediaOriginal({ ...base, byteLength: -1 }), TypeError);
  assert.throws(() => createMediaOriginal({ ...base, byteLength: 1.5 }), TypeError);
  assert.throws(() => createMediaOriginal({ ...base, kind: "unknown" }), TypeError);
  assert.throws(() => createMediaOriginal({ ...base, id: "../escape" }), TypeError);
  assert.throws(() => createMediaDerivative({
    id: "preview1", originalId: "original1", familyId: "family1", variant: "untrusted"
  }), TypeError);
});

test("original media bytes verify against real SHA-256, not just inventory metadata", async () => {
  const bytes = new TextEncoder().encode("synthetic family photo bytes");
  const digest = await webcrypto.subtle.digest("SHA-256", bytes);
  const sha256 = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
  const original = createMediaOriginal({
    id: "original1", familyId: "family1", memoryId: "picnic",
    contributorId: "casey", kind: "photo", byteLength: bytes.length, sha256
  });
  assert.equal(await verifyMediaOriginalBytes(original, bytes, webcrypto.subtle), true);
  assert.equal(await verifyMediaOriginalBytes(original, new TextEncoder().encode("synthetic family photo byteS"), webcrypto.subtle), false);
  assert.equal(await verifyMediaOriginalBytes({ ...original, byteLength: bytes.length + 1 }, bytes, webcrypto.subtle), false);
  assert.equal(await verifyMediaOriginalBytes(original, bytes, null), false);
  assert.equal(await verifyMediaOriginalBytes(original, "synthetic family photo bytes", webcrypto.subtle), false);
});

test("media verification hashes only visible bytes of a sliced Buffer", async () => {
  const whole = Buffer.from("prefix-synthetic-suffix");
  const sliced = whole.subarray(7, 16);
  const digest = await webcrypto.subtle.digest("SHA-256", sliced);
  const sha256 = Buffer.from(digest).toString("hex");
  const original = createMediaOriginal({
    id: "original2", familyId: "family1", memoryId: "picnic",
    contributorId: "casey", kind: "audio", byteLength: sliced.byteLength, sha256
  });
  assert.equal(await verifyMediaOriginalBytes(original, sliced, webcrypto.subtle), true);
  assert.equal(await verifyMediaOriginalBytes(original, whole, webcrypto.subtle), false);
});
