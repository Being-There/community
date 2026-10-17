// Completely invented recovery drill fixture; no family data or services.
import { webcrypto } from 'node:crypto';
import { createFamily, createPerson, createMemory, createStory, createMediaOriginal } from '../src/core/family-model.mjs';
import { createMemoryOriginalStore, preserveOriginal } from '../src/core/original-storage.mjs';

function tone(frequency) {
  const samples = 800;
  const bytes = new Uint8Array(44 + samples * 2);
  const view = new DataView(bytes.buffer);
  const text = (offset, value) => [...value].forEach((c, i) => { bytes[offset + i] = c.charCodeAt(0); });
  text(0, 'RIFF'); view.setUint32(4, bytes.length - 8, true); text(8, 'WAVE');
  text(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
  view.setUint16(22, 1, true); view.setUint32(24, 8000, true); view.setUint32(28, 16000, true);
  view.setUint16(32, 2, true); view.setUint16(34, 16, true); text(36, 'data');
  view.setUint32(40, samples * 2, true);
  for (let i = 0; i < samples; i++) view.setInt16(44 + i * 2, Math.round(3000 * Math.sin(2 * Math.PI * frequency * i / 8000)), true);
  return bytes;
}
export async function archiveFamilyFixture(familyId = 'fictionalFamilyA') {
  const family = createFamily({ id: familyId, label: 'Fictional recovery household' });
  const contributors = ['casey', 'morgan'].map(id => ({ id, familyId, displayName: id === 'casey' ? 'Casey (fictional)' : 'Morgan (fictional)' }));
  const people = ['avery', 'riley'].map(id => createPerson({ id, familyId, displayName: id === 'avery' ? 'Avery (fictional)' : 'Riley (fictional)' }));
  const memories = [
    { ...createMemory({ id: 'garden', familyId, personIds: ['avery', 'riley'], title: 'An invented garden afternoon', contributorId: 'casey' }), originalIds: ['gardenPhoto'], hidden: false },
    { ...createMemory({ id: 'park', familyId, personIds: ['avery'], title: 'An invented quiet park', contributorId: 'morgan' }), originalIds: ['parkPhoto'], hidden: true }
  ];
  const stories = [
    { ...createStory({ id: 'storyA', familyId, memoryId: 'garden', contributorId: 'casey', text: 'Fictional perspective A. The audio is only a test tone.' }), recordingId: 'toneA' },
    { ...createStory({ id: 'storyB', familyId, memoryId: 'garden', contributorId: 'morgan', text: 'Fictional perspective B. No one needs to answer.' }), recordingId: 'toneB' }
  ];
  const svg = label => new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg" width="320" height="240"><rect width="320" height="240" fill="#cfe5cf"/><text x="20" y="120">' + label + ' (fictional)</text></svg>');
  const payloads = [
    ['gardenPhoto', 'garden', 'casey', 'photo', svg('Garden')],
    ['parkPhoto', 'park', 'morgan', 'photo', svg('Park')],
    ['toneA', 'garden', 'casey', 'audio', tone(440)],
    ['toneB', 'garden', 'morgan', 'audio', tone(660)]
  ];
  const store = createMemoryOriginalStore();
  const originals = [];
  for (const [id, memoryId, contributorId, kind, bytes] of payloads) {
    const hash = new Uint8Array(await webcrypto.subtle.digest('SHA-256', bytes));
    const sha256 = [...hash].map(x => x.toString(16).padStart(2, '0')).join('');
    const original = createMediaOriginal({ id, familyId, memoryId, contributorId, kind, byteLength: bytes.length, sha256 });
    await preserveOriginal({ original, bytes, store, subtleCrypto: webcrypto.subtle });
    originals.push(original);
  }
  return { content: { family, contributors, people, memories, stories, originals }, store, expectedFamilyId: familyId, subtleCrypto: webcrypto.subtle };
}
