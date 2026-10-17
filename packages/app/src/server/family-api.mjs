// Fetch-compatible protected read boundary. No public login/provisioning bypass.
import { AccessError } from './sessions.mjs';
import { validateMembership, canReadMemory } from './family-policy.mjs';
import { verifyMediaOriginalBytes } from '../core/family-model.mjs';
const id = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,80}$/.test(value);
const headers = Object.freeze({ 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer', 'Cross-Origin-Resource-Policy': 'same-origin',
  'Content-Security-Policy': "default-src 'none'; sandbox; frame-ancestors 'none'", Vary: 'Cookie' });
function safeMediaType(bytes, kind) {
  if (bytes.length >= 12 && Buffer.from(bytes.subarray(0, 4)).toString() === 'RIFF') {
    const kind = Buffer.from(bytes.subarray(8, 12)).toString();
    if (kind === 'WAVE') return 'audio/wav';
    if (kind === 'WEBP') return 'image/webp';
  }
  if (bytes.length >= 8 && Buffer.from(bytes.subarray(0, 8)).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'image/png';
  if (bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'image/jpeg';
  if (bytes.length >= 4 && Buffer.from(bytes.subarray(0, 4)).equals(Buffer.from([26, 69, 223, 163]))) return kind === 'audio' ? 'audio/webm' : null;
  if (bytes.length >= 12 && Buffer.from(bytes.subarray(4, 8)).toString() === 'ftyp') return kind === 'audio' ? 'audio/mp4' : null;
  return null;
}
function rangeFor(value, size) {
  if (value === null) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(value);
  if (!match || (!match[1] && !match[2])) throw new AccessError(416);
  let start, end;
  if (!match[1]) { const suffix = Number(match[2]); if (!Number.isSafeInteger(suffix) || suffix < 1) throw new AccessError(416); start = Math.max(0, size - suffix); end = size - 1; }
  else { start = Number(match[1]); end = match[2] ? Number(match[2]) : size - 1; }
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start >= size || end < start) throw new AccessError(416);
  return [start, Math.min(end, size - 1)];
}
export function createFamilyApi({ sessions, repository, appOrigin, subtleCrypto, maxMediaBytes = 64 * 1024 * 1024 }) {
  const origin = new URL(appOrigin);
  if (origin.protocol !== 'https:' || origin.origin !== appOrigin || !Number.isSafeInteger(maxMediaBytes) || maxMediaBytes < 1 || maxMediaBytes > 256 * 1024 * 1024)
    throw new TypeError('Explicit HTTPS application origin and bounded media limit required');
  for (const method of ['getMembership', 'listMemories', 'getMemory', 'listStories', 'getMedia', 'getMediaBytes'])
    if (typeof repository?.[method] !== 'function') throw new TypeError('Family-scoped repository required');
  if (!sessions || !subtleCrypto) throw new TypeError('Sessions and byte verification required');
  return async function handle(request) {
    const reply = (status, body, extra = {}) => new Response(request.method === 'HEAD' || status === 204 ? null : body,
      { status, headers: { ...headers, ...extra } });
    const json = (status, value) => reply(status, JSON.stringify(value), { 'Content-Type': 'application/json; charset=utf-8' });
    try {
      const url = new URL(request.url);
      if (url.origin !== appOrigin) return json(404, { error: 'Not found' });
      const route = /^\/api\/families\/([A-Za-z0-9_-]{1,80})\/(memories|media)(?:\/([A-Za-z0-9_-]{1,80}))?(?:\/(stories))?$/.exec(url.pathname);
      const logout = url.pathname === '/api/session/logout';
      if (!route && !logout && url.pathname !== '/api/session') return json(404, { error: 'Not found' });
      const principal = await sessions.authenticate(request);
      if (request.headers.has('x-being-there-account') && request.headers.get('x-being-there-account') !== principal.accountId) throw new AccessError(409);
      if (logout) {
        if (request.method !== 'POST') return json(405, { error: 'Method not allowed' });
        sessions.requireMutation(request, principal, appOrigin);
        await sessions.logout(principal);
        const response = reply(204, null);
        for (const value of sessions.clearCookies()) response.headers.append('Set-Cookie', value);
        return response;
      }
      if (!route) {
        if (request.method !== 'GET') return json(405, { error: 'Method not allowed' });
        return json(200, { authenticated: true, accountId: principal.accountId });
      }
      const [, familyId, resource, resourceId, nested] = route;
      if (nested && (resource !== 'memories' || !resourceId)) throw new AccessError(404);
      // No membership cache: the source of truth is consulted on EVERY operation.
      const membership = validateMembership(await repository.getMembership(principal.accountId, familyId), principal.accountId, familyId);
      async function latestAccess() {
        const current = await sessions.authenticate(request);
        if (current.accountId !== principal.accountId) throw new AccessError(401);
        return validateMembership(await repository.getMembership(current.accountId, familyId), current.accountId, familyId);
      }
      function project(memory) { return { id: memory.id, originalIds: Array.isArray(memory.originalIds) ? memory.originalIds.filter(id) : [], title: typeof memory.title === 'string' ? memory.title : '', personIds: Array.isArray(memory.personIds) ? memory.personIds.filter(id) : [], hidden: memory.hidden === true, renditions: repository.getImageRenditions?.(familyId, memory.originalIds?.[0]) ?? [] }; }
      if (!['GET', 'HEAD'].includes(request.method)) return json(405, { error: 'Method not allowed' });
      if (resource === 'memories' && !resourceId) {
        if (request.method !== 'GET') return json(405, { error: 'Method not allowed' });
        const rows = await repository.listMemories(familyId);
        if (!Array.isArray(rows) || rows.length > 10000 || rows.some(row => row?.familyId !== familyId)) throw new Error('Invalid scoped repository result');
        const latest = await latestAccess();
        return json(200, { memories: rows.filter(row => canReadMemory(latest, row)).map(project) });
      }
      if (!resourceId) throw new AccessError(404);
      if (resource === 'memories') {
        const memory = await repository.getMemory(familyId, resourceId);
        if (memory?.id !== resourceId || !canReadMemory(membership, memory)) throw new AccessError(404);
        let stories;
        if (nested === 'stories') {
          const rows = await repository.listStories(familyId, resourceId, { limit: 100 });
          if (!Array.isArray(rows) || rows.length > 100) throw new Error('Invalid scoped stories');
          stories = [];
          for (const story of rows) {
            if (story?.familyId !== familyId || story.memoryId !== resourceId || !id(story.id) || !id(story.contributorId) ||
                typeof story.text !== 'string' || story.text.length > 1000000 ||
                (story.recordingId !== null && !id(story.recordingId))) throw new Error('Invalid scoped story');
            if (story.recordingId !== null) {
              const recording = await repository.getMedia(familyId, story.recordingId);
              if (!recording || recording.id !== story.recordingId || recording.familyId !== familyId || recording.memoryId !== resourceId ||
                  recording.contributorId !== story.contributorId || recording.kind !== 'audio' || recording.originalId !== undefined) throw new Error('Invalid recording reference');
            }
            stories.push({ id: story.id, contributorId: story.contributorId, text: story.text, recordingId: story.recordingId });
          }
        }
        const latest = await latestAccess();
        const latestMemory = await repository.getMemory(familyId, resourceId);
        if (latestMemory?.id !== resourceId || !canReadMemory(latest, latestMemory)) throw new AccessError(404);
        if (stories) return json(200, { stories });
        return json(200, project(latestMemory));
      }
      let resolvedId = resourceId;
      let storedMedia = await repository.getMedia(familyId, resourceId);
      if (url.searchParams.has('variant')) {
        const requested = url.searchParams.get('variant');
        const kinds = { small: 'thumbnail', medium: 'preview', large: 'playback' };
        const kind = Object.hasOwn(kinds, requested) ? kinds[requested] : null;
        if (!kind || url.searchParams.getAll('variant').length !== 1) throw new AccessError(400);
        if (!storedMedia || storedMedia.familyId !== familyId || storedMedia.originalId !== undefined) throw new AccessError(404);
        const candidate = await repository.getMedia(familyId, resourceId + '_' + requested);
        if (candidate) {
          if (candidate.originalId !== resourceId || candidate.variant !== kind || candidate.memoryId !== storedMedia.memoryId || candidate.contributorId !== storedMedia.contributorId) throw new AccessError(404);
          resolvedId = resourceId + '_' + requested; storedMedia = candidate;
        }
      }
      const media = storedMedia && { ...storedMedia };
      if (!media || media.id !== resolvedId || media.familyId !== familyId || !id(media.memoryId ?? '') || !id(media.contributorId ?? '')) throw new AccessError(404);
      const memory = await repository.getMemory(familyId, media.memoryId);
      if (memory?.id !== media.memoryId || !canReadMemory(membership, memory)) throw new AccessError(404);
      if (media.originalId !== undefined) {
        const original = await repository.getMedia(familyId, media.originalId);
        if (!original || original.id !== media.originalId || original.familyId !== familyId || original.memoryId !== media.memoryId ||
            original.contributorId !== media.contributorId || original.originalId !== undefined || !['thumbnail', 'preview', 'playback'].includes(media.variant)) throw new AccessError(404);
      }
      if (!Number.isSafeInteger(media.byteLength) || media.byteLength < 1 || media.byteLength > maxMediaBytes) throw new AccessError(503);
      let range;
      try { range = rangeFor(request.method === 'HEAD' ? null : request.headers.get('range'), media.byteLength); }
      catch (error) { if (error.status === 416) return reply(416, null, { 'Content-Range': 'bytes */' + media.byteLength }); throw error; }
      const raw = await repository.getMediaBytes(familyId, resolvedId);
      if (!(raw instanceof Uint8Array) || raw.byteLength !== media.byteLength) throw new AccessError(503);
      const bytes = Uint8Array.from(raw);
      if (!await verifyMediaOriginalBytes(media, bytes, subtleCrypto)) throw new AccessError(503);
      // Recheck access after blob I/O before returning any bytes/metadata.
      const latest = await latestAccess();
      const latestMedia = await repository.getMedia(familyId, resolvedId);
      if (!latestMedia || ['id', 'familyId', 'memoryId', 'contributorId', 'originalId', 'variant', 'sha256', 'byteLength'].some(key => latestMedia[key] !== media[key])) throw new AccessError(404);
      const latestMemory = await repository.getMemory(familyId, media.memoryId);
      if (latestMemory?.id !== media.memoryId || !canReadMemory(latest, latestMemory)) throw new AccessError(404);
      const type = safeMediaType(bytes, media.kind);
      const extra = { 'Content-Type': type ?? 'application/octet-stream', 'Content-Disposition': type ? 'inline' : 'attachment',
        'Accept-Ranges': 'bytes', 'Content-Length': String(range ? range[1] - range[0] + 1 : bytes.length) };
      if (range) extra['Content-Range'] = 'bytes ' + range[0] + '-' + range[1] + '/' + bytes.length;
      return reply(range ? 206 : 200, range ? bytes.slice(range[0], range[1] + 1) : bytes, extra);
    } catch (error) {
      const status = error instanceof AccessError ? error.status : 503;
      return json(status, { error: status === 401 ? 'Sign in required' : status === 403 ? 'Request denied' : status === 404 ? 'Not found' : 'Service unavailable' });
    }
  };
}
