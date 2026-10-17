// Synthetic adapters only; no provider, durable account store or production server.
import { webcrypto } from 'node:crypto';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { archiveFamilyFixture } from '../../examples/archive-family.mjs';
import { originalStorageKey } from '../../src/core/original-storage.mjs';
import { createSessionService, AccessError } from '../../src/server/sessions.mjs';
import { createFamilyApi } from '../../src/server/family-api.mjs';
export const appOrigin = 'https://family.example.test';
export const tuple = (...parts) => JSON.stringify(parts);
export async function familyApiFixture(t, sessionOptions = {}) {
  let clock = 1800000000000;
  const accounts = new Map(['alice', 'casey', 'bob', 'visitor', 'scoped'].map(id => [id, {
    id, state: 'active', issuer: 'https://identity.example.test', subject: 'fictional-' + id
  }]));
  const memberships = new Map();
  for (const [accountId, familyId, role, scope] of [
    ['alice', 'familyA', 'organizer', { kind: 'family' }],
    ['casey', 'familyA', 'contributor', { kind: 'family' }],
    ['bob', 'familyB', 'organizer', { kind: 'family' }],
    ['scoped', 'familyA', 'contributor', { kind: 'memories', memoryIds: ['garden'] }]
  ]) memberships.set(tuple(accountId, familyId), { accountId, familyId, state: 'active', role, scope });
  const stories = new Map(), memories = new Map(), media = new Map(), objects = new Map(), sessionRows = new Map();
  for (const familyId of ['familyA', 'familyB']) {
    const fixture = await archiveFamilyFixture(familyId);
    for (const story of fixture.content.stories) stories.set(tuple(familyId, story.id), structuredClone(story));
    for (const memory of fixture.content.memories) memories.set(tuple(familyId, memory.id), structuredClone(memory));
    for (const original of fixture.content.originals) {
      media.set(tuple(familyId, original.id), { ...original });
      objects.set(tuple(familyId, original.id), await fixture.store.get(originalStorageKey(original)));
    }
  }
  const calls = { mediaBytes: 0, metadata: 0, membership: 0 };
  const repository = {
    async findAccountByIdentity(issuer, subject) { return [...accounts.values()].find(row => row.issuer === issuer && row.subject === subject) ?? null; },
    async getAccount(id) { return accounts.get(id) ?? null; },
    async getSession(hash) { const row = sessionRows.get(hash); return row ? { ...row } : null; },
    async replaceSession({ oldHash, newHash, record }) {
      // Synchronous single-process test transaction; real adapter needs durable CAS.
      if (sessionRows.has(newHash)) throw new Error('Session collision');
      if (oldHash) sessionRows.delete(oldHash);
      sessionRows.set(newHash, { ...record });
    },
    async touchSession(hash, at) { const row = sessionRows.get(hash); if (!row) return false; row.lastSeenAt = Math.max(row.lastSeenAt, at); return true; },
    async deleteSession(hash) { sessionRows.delete(hash); },
    async getMembership(accountId, familyId) { calls.membership++; return memberships.get(tuple(accountId, familyId)) ?? null; },
    async listMemories(familyId) { calls.metadata++; return [...memories.values()].filter(row => row.familyId === familyId); },
    async listStories(familyId, memoryId) { calls.metadata++; return [...stories.values()].filter(row => row.familyId === familyId && row.memoryId === memoryId); },
    async getMemory(familyId, id) { calls.metadata++; return memories.get(tuple(familyId, id)) ?? null; },
    async getMedia(familyId, id) { calls.metadata++; return media.get(tuple(familyId, id)) ?? null; },
    async getMediaBytes(familyId, id) { calls.mediaBytes++; return objects.get(tuple(familyId, id)) ?? null; }
  };
  const verifyIdentity = async proof => {
    const account = accounts.get(proof);
    if (!account) throw new AccessError(401);
    return { issuer: account.issuer, subject: account.subject, authenticatedAt: clock };
  };
  const sessions = createSessionService({ repository, verifyIdentity, now: () => clock, ...sessionOptions });
  const api = createFamilyApi({ sessions, repository, appOrigin, subtleCrypto: webcrypto.subtle });
  const server = createServer(async (req, res) => {
    try {
      const request = new Request(new URL(req.url, appOrigin), { method: req.method, headers: req.headers });
      const response = await api(request);
      res.statusCode = response.status;
      for (const [key, value] of response.headers) if (key !== 'set-cookie') res.setHeader(key, value);
      if (response.headers.getSetCookie().length) res.setHeader('set-cookie', response.headers.getSetCookie());
      res.end(Buffer.from(await response.arrayBuffer()));
    } catch { res.writeHead(500); res.end(); }
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const address = 'http://127.0.0.1:' + server.address().port;
  const request = (path, options = {}) => fetch(address + path, options);
  const signIn = async (accountId, previousRequest) => {
    const result = await sessions.signIn(accountId, previousRequest);
    return { ...result, cookie: [result.sessionCookie, result.csrfCookie].map(value => value.split(';')[0]).join('; ') };
  };
  return { api, repository, accounts, memberships, memories, stories, media, objects, sessionRows, sessions, calls, signIn, request,
    setClock: value => { clock = value; }, advance: ms => { clock += ms; }, now: () => clock };
}
