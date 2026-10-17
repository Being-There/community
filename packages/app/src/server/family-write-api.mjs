import { webcrypto } from 'node:crypto';
import { preparePhoto } from './photo-processing.mjs';
import { AccessError } from './sessions.mjs';
import { validateMembership, canReadMemory, requireOrganizer } from './family-policy.mjs';
import { createFamilyArchive } from '../core/family-archive.mjs';
import { encodeArchiveFiles } from './archive-transport.mjs';
const maxBody = 24 * 1024 * 1024;
const common = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', Vary: 'Cookie' };
export async function boundedJson(request) {
  if (request.headers.get('content-type')?.split(';')[0] !== 'application/json') throw new AccessError(415);
  if (Number(request.headers.get('content-length')) > maxBody) throw new AccessError(413);
  const reader = request.body?.getReader(); if (!reader) return {};
  const parts = []; let size = 0;
  try { while (true) { const result = await reader.read(); if (result.done) break; size += result.value.byteLength; if (size > maxBody) { await reader.cancel(); throw new AccessError(413); } parts.push(result.value); } }
  finally { reader.releaseLock(); }
  if (!size) return {};
  try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(parts))); } catch { throw new AccessError(400); }
}
function fields(value, required, optional = []) {
  if (!value || Array.isArray(value) || typeof value !== 'object' || required.some(key => !Object.hasOwn(value, key)) || Object.keys(value).some(key => ![...required, ...optional].includes(key))) throw new AccessError(400);
}
function bytes(base64) {
  if (typeof base64 !== 'string' || base64.length > 20 * 1024 * 1024) throw new AccessError(413);
  const result = Buffer.from(base64, 'base64'); if (!result.length || result.toString('base64') !== base64) throw new AccessError(400); return result;
}
function videoBytes(base64, mimeType) {
  const data = bytes(base64);
  if (data.length > 14 * 1024 * 1024) throw new AccessError(413);
  const webm = data.length >= 4 && data.subarray(0, 4).equals(Buffer.from([26, 69, 223, 163]));
  const mp4 = data.length >= 12 && data.subarray(4, 8).toString() === 'ftyp';
  if (!((mimeType === 'video/webm' && webm) || (mimeType === 'video/mp4' && mp4))) throw new AccessError(415);
  return data;
}
export function createFamilyWriteApi({ sessions, repository, appOrigin, readApi }) {
  return async request => {
    const url = new URL(request.url);
    const family = /^\/api\/families\/([A-Za-z0-9_-]{1,80})\/(people|contributors|contributions|invitations|exports|members)(?:\/([A-Za-z0-9_-]{1,80})\/(stories|revoke))?$/.exec(url.pathname);
    const story = /^\/api\/families\/([A-Za-z0-9_-]{1,80})\/memories\/([A-Za-z0-9_-]{1,80})\/stories$/.exec(url.pathname);
    const acceptance = ['/api/invitations/accept', '/api/invitations/preview'].includes(url.pathname);
    const familyList = url.pathname === '/api/families';
    if (!family && !(story && request.method === 'POST') && !acceptance && !familyList) return readApi(request);
    const json = (status, value, extra = {}) => new Response(JSON.stringify(value), { status, headers: { ...common, 'Content-Type': 'application/json; charset=utf-8', ...extra } });
    try {
      if (url.origin !== appOrigin) throw new AccessError(404);
      const principal = await sessions.authenticate(request);
      if (request.headers.has('x-being-there-account') && request.headers.get('x-being-there-account') !== principal.accountId) throw new AccessError(409);
      if (familyList) { if (request.method !== 'GET') throw new AccessError(405); return json(200, { families: repository.listFamilies(principal.accountId) }); }
      if (family?.[3] && (!['members', 'invitations'].includes(family[2]) || family[4] !== 'revoke')) throw new AccessError(404);
      const familyId = family?.[1] ?? story?.[1];
      const membership = familyId ? validateMembership(await repository.getMembership(principal.accountId, familyId), principal.accountId, familyId) : null;
      if (family?.[2] === 'people' && request.method === 'GET') {
        let people = repository.listPeople(familyId);
        if (membership.scope.kind !== 'family') {
          const ids = new Set(repository.listMemories(familyId).filter(memory => canReadMemory(membership, memory)).flatMap(memory => memory.personIds));
          people = people.filter(person => ids.has(person.id));
        }
        return json(200, { people });
      }
      if (family?.[2] === 'contributors' && request.method === 'GET') {
        let contributors = repository.listContributors(familyId);
        if (membership.scope.kind !== 'family') {
          const allowed = repository.listMemories(familyId).filter(memory => canReadMemory(membership, memory));
          const ids = new Set(allowed.flatMap(memory => [memory.contributorId, ...repository.listStories(familyId, memory.id).map(story => story.contributorId)]));
          contributors = contributors.filter(row => ids.has(row.id));
        }
        return json(200, { contributors });
      }
      if (family?.[2] === 'members' && request.method === 'GET') { requireOrganizer(membership); return json(200, { members: repository.listMembers(familyId) }); }
      if (family?.[2] === 'invitations' && request.method === 'GET') { requireOrganizer(membership); return json(200, { invitations: repository.listInvitations(familyId) }); }
      if (request.method !== 'POST') throw new AccessError(405);
      sessions.requireMutation(request, principal, appOrigin);
      if (family?.[2] === 'exports') {
        requireOrganizer(membership); sessions.requireRecentAuthentication(principal);
        const snapshot = repository.exportSnapshot(principal, familyId);
        const files = await createFamilyArchive({ content: snapshot.content, expectedFamilyId: familyId, subtleCrypto: webcrypto.subtle,
          store: { get: async key => { const parts = key.split('/'); return parts.length === 4 && parts[0] === 'families' && parts[1] === familyId && parts[2] === 'originals' ? snapshot.bytes.get(parts[3]) ?? null : null; } } });
        // No temporary export files; recheck current authority after hashing.
        const current = await sessions.authenticate(request); sessions.requireRecentAuthentication(current);
        requireOrganizer(validateMembership(repository.getMembership(current.accountId, familyId), current.accountId, familyId));
        repository.recordExportAudit(current, familyId);
        return json(200, encodeArchiveFiles(files), { 'Content-Disposition': 'attachment; filename="being-there-export.json"' });
      }
      const input = await boundedJson(request);
      // Authorization is rechecked inside the durable commit transaction.
      if (acceptance) { fields(input, ['token'], ['displayName']); return json(200, url.pathname.endsWith('/preview') ? repository.previewInvitation(principal, input.token) : repository.acceptInvitation(principal, input.token, input.displayName)); }
      if (story) {
        fields(input, ['id', 'text'], ['base64', 'mimeType']);
        let audio = null;
        if (input.base64 !== undefined) {
          audio = bytes(input.base64);
          const riff = audio.subarray(0, 4).toString() === 'RIFF' && audio.subarray(8, 12).toString() === 'WAVE';
          const webm = audio.length >= 4 && audio.subarray(0, 4).equals(Buffer.from([26, 69, 223, 163]));
          const mp4 = audio.subarray(4, 8).toString() === 'ftyp';
          if (!((riff && input.mimeType === 'audio/wav') || (webm && /^audio\/webm(?:;codecs=opus)?$/.test(input.mimeType)) || (mp4 && /^audio\/mp4/.test(input.mimeType)))) throw new AccessError(415);
        }
        if (!audio && (typeof input.text !== 'string' || !input.text.trim())) throw new AccessError(400);
        return json(200, repository.commitStory(principal, familyId, story[2], { ...input, bytes: audio }));
      }
      if (family[2] === 'people') { fields(input, ['id', 'displayName']); return json(201, repository.createPerson(principal, familyId, input)); }
      if (family[2] === 'invitations' && family[4] === 'revoke') { fields(input, []); return json(200, repository.revokeInvitation(principal, familyId, family[3])); }
      if (family[2] === 'invitations') { fields(input, ['email', 'role']); requireOrganizer(membership); return json(201, repository.createInvitation(principal, familyId, input)); }
      if (family[2] === 'members' && family[4] === 'revoke') { fields(input, []); requireOrganizer(membership); return json(200, repository.revokeMember(principal, familyId, family[3])); }
      if (family[2] === 'contributions') {
        fields(input, ['id', 'title', 'personIds', 'base64'], ['mimeType']);
        if (input.mimeType !== undefined) {
          return json(200, repository.commitVideo(principal, familyId, { ...input, bytes: videoBytes(input.base64, input.mimeType) }));
        }
        let photo;
        try { photo = await preparePhoto(bytes(input.base64)); }
        catch (error) { if (error instanceof AccessError) throw error; throw new AccessError(415); }
        return json(200, repository.commitPhoto(principal, familyId, { ...input, ...photo }));
      }
      throw new AccessError(404);
    } catch (error) { const status = error instanceof AccessError ? error.status : 503; return json(status, { error: ({ 400: 'Invalid request', 401: 'Sign in required', 403: 'Request denied', 404: 'Not found', 405: 'Method not allowed', 409: 'Conflicting existing record', 413: 'File too large', 415: 'Unsupported or invalid media' })[status] ?? 'Service unavailable' }); }
  };
}
