// Upload one exact, immutable original into the organizer's private Drive folder.
// No browser token, public link, transformed media, or shared Being There backend.
import { createHash, randomUUID } from 'node:crypto';
import { OAuth2Client } from 'google-auth-library';
import { AccessError } from './sessions.mjs';
import { validateMembership, requireOrganizer } from './family-policy.mjs';

const scope = 'https://www.googleapis.com/auth/drive.file';
const uploadUrl = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,parents,size,md5Checksum';
const maxOriginalBytes = 14 * 1024 * 1024; // bounded multipart; larger files need resumable uploads
const common = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer', Vary: 'Cookie' };
const json = (status, value) => new Response(JSON.stringify(value), { status,
  headers: { ...common, 'Content-Type': 'application/json; charset=utf-8' } });
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const md5 = bytes => createHash('md5').update(bytes).digest('hex');

function mediaType(original, bytes) {
  const head = Buffer.from(bytes.subarray(0, 16));
  if (original.kind === 'photo') {
    if (head.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return ['image/png', '.png'];
    if (head.subarray(0, 3).equals(Buffer.from([255,216,255]))) return ['image/jpeg', '.jpg'];
    if (head.subarray(0, 4).toString() === 'RIFF' && head.subarray(8, 12).toString() === 'WEBP') return ['image/webp', '.webp'];
  }
  if (original.kind === 'audio' && head.subarray(0, 4).toString() === 'RIFF' &&
      head.subarray(8, 12).toString() === 'WAVE') return ['audio/wav', '.wav'];
  if (['audio', 'video'].includes(original.kind)) {
    if (head.subarray(0, 4).equals(Buffer.from([26,69,223,163])))
      return [original.kind + '/webm', '.webm'];
    if (head.subarray(4, 8).toString() === 'ftyp')
      return [original.kind + '/mp4', '.mp4'];
  }
  // Never fabricate a media extension or transcode an unrecognized original.
  return ['application/octet-stream', '.bin'];
}

export function createDriveOriginal({ sessions, repository, appOrigin, clientId, clientSecret,
  refreshAccessToken, driveFetch = fetch }) {
  if (!appOrigin?.startsWith('https://') || new URL(appOrigin).origin !== appOrigin ||
      !clientId || !clientSecret || !sessions || !repository ||
      ['getMembership', 'getAccount', 'getDriveCredential', 'getDriveFolder', 'getMedia',
        'getMediaBytes', 'getDriveOriginal', 'reserveDriveOriginal', 'finishDriveOriginal']
        .some(name => typeof repository[name] !== 'function') ||
      typeof driveFetch !== 'function' ||
      (refreshAccessToken !== undefined && typeof refreshAccessToken !== 'function'))
    throw new TypeError('Private original repository, verified sessions and HTTPS origin required');

  const refresh = refreshAccessToken ?? (async refreshToken => {
    const oauth = new OAuth2Client({ clientId, clientSecret });
    oauth.setCredentials({ refresh_token: refreshToken });
    return (await oauth.getAccessToken())?.token;
  });

  return Object.freeze({ async handle(request) {
    try {
      const url = new URL(request.url);
      const match = /^\/api\/families\/([A-Za-z0-9_-]{1,80})\/drive\/originals\/([A-Za-z0-9_-]{1,80})$/.exec(url.pathname);
      if (url.origin !== appOrigin || !match || url.search || request.method !== 'POST' ||
          request.headers.has('content-length') && Number(request.headers.get('content-length')) > 0)
        throw new AccessError(404);
      const [, familyId, originalId] = match;

      async function authorize() {
        const principal = await sessions.authenticate(request);
        requireOrganizer(validateMembership(
          await repository.getMembership(principal.accountId, familyId), principal.accountId, familyId));
        sessions.requireMutation(request, principal, appOrigin);
        sessions.requireRecentAuthentication(principal);
        const account = await repository.getAccount(principal.accountId);
        if (account?.id !== principal.accountId || account.issuer !== 'https://accounts.google.com' ||
            typeof account.subject !== 'string' || !account.subject) throw new AccessError(401);
        return { principal, subject: account.subject };
      }
      const first = await authorize();
      const second = await authorize();
      if (second.principal.sessionHash !== first.principal.sessionHash ||
          second.subject !== first.subject) throw new AccessError(401);

      function originalMetadata() {
        const row = repository.getMedia(familyId, originalId);
        if (!row || row.id !== originalId || row.familyId !== familyId ||
            row.originalId !== undefined || !['photo', 'video', 'audio'].includes(row.kind) ||
            !/^[a-f0-9]{64}$/.test(row.sha256 ?? '') ||
            !Number.isSafeInteger(row.byteLength) || row.byteLength < 1)
          throw new AccessError(404);
        if (row.byteLength > maxOriginalBytes) throw new AccessError(413);
        return row;
      }
      const original = originalMetadata();
      // Revalidate immediately before reading original bytes from private storage.
      await authorize();
      const bytes = repository.getMediaBytes(familyId, originalId);
      if (!(bytes instanceof Uint8Array) || bytes.length !== original.byteLength ||
          sha(bytes) !== original.sha256) throw new AccessError(503);
      const stableBytes = Buffer.from(bytes);
      const [mimeType, extension] = mediaType(original, stableBytes);
      const name = 'being-there-original-' + originalId + '-' + original.sha256 + extension;

      const credential = repository.getDriveCredential(second.principal, familyId);
      if (!credential || credential.scope !== scope || credential.subject !== first.subject)
        throw new AccessError(404);
      const folder = repository.getDriveFolder(second.principal, familyId);
      if (folder?.state !== 'ready') throw new AccessError(folder ? 409 : 404);
      const previous = repository.getDriveOriginal(second.principal, familyId, original, credential, folder.id);
      if (previous?.state === 'ready')
        return json(200, { fileId: previous.id, originalId, sha256: original.sha256, created: false });
      if (previous) throw new AccessError(409);

      let token;
      try { token = await refresh(credential.refreshToken); }
      catch { throw new AccessError(503); }
      if (typeof token !== 'string' || !token || token.length > 8192) throw new AccessError(503);

      async function stillAuthorized() {
        const latest = await authorize();
        if (latest.principal.sessionHash !== first.principal.sessionHash ||
            latest.subject !== first.subject) throw new AccessError(401);
        const current = repository.getDriveCredential(latest.principal, familyId);
        const currentFolder = repository.getDriveFolder(latest.principal, familyId);
        if (!current || current.subject !== credential.subject || current.scope !== credential.scope ||
            current.generation !== credential.generation || current.refreshToken !== credential.refreshToken ||
            currentFolder?.state !== 'ready' || currentFolder.id !== folder.id) throw new AccessError(404);
        const latestOriginal = originalMetadata();
        if (latestOriginal.sha256 !== original.sha256 || latestOriginal.byteLength !== original.byteLength ||
            latestOriginal.kind !== original.kind || latestOriginal.memoryId !== original.memoryId ||
            latestOriginal.contributorId !== original.contributorId) throw new AccessError(404);
        return latest.principal;
      }
      const principal = await stillAuthorized();
      const claim = repository.reserveDriveOriginal(principal, familyId, original, credential, folder.id);
      await stillAuthorized();

      const boundary = 'bt_' + randomUUID().replaceAll('-', '');
      const metadata = JSON.stringify({ name, mimeType, parents: [folder.id] });
      const body = Buffer.concat([
        Buffer.from('--' + boundary + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' +
          metadata + '\r\n--' + boundary + '\r\nContent-Type: ' + mimeType + '\r\n\r\n'),
        stableBytes, Buffer.from('\r\n--' + boundary + '--\r\n')
      ]);
      let response;
      try {
        response = await driveFetch(uploadUrl, { method: 'POST', redirect: 'error', cache: 'no-store',
          headers: { Authorization: 'Bearer ' + token, Accept: 'application/json',
            'Content-Type': 'multipart/related; boundary=' + boundary }, body });
      } catch { throw new AccessError(503); }
      if (response?.status !== 200 && response?.status !== 201) throw new AccessError(503);
      let result;
      try { result = await response.json(); } catch { throw new AccessError(503); }
      if (!result || typeof result.id !== 'string' || !/^[A-Za-z0-9_-]{10,200}$/.test(result.id) ||
          result.name !== name || result.mimeType !== mimeType ||
          !Array.isArray(result.parents) || result.parents.length !== 1 ||
          result.parents[0] !== folder.id || result.size !== String(stableBytes.length) ||
          result.md5Checksum !== md5(stableBytes)) throw new AccessError(503);
      // Revocation cannot undo in-flight Drive I/O, but cannot acknowledge it.
      const final = await stillAuthorized();
      repository.finishDriveOriginal(final, familyId, original, credential, folder.id, claim, result.id);
      return json(201, { fileId: result.id, originalId, sha256: original.sha256, created: true });
    } catch (error) {
      const status = error instanceof AccessError ? error.status : 503;
      return json(status, { error: ({ 401: 'Sign in required', 403: 'Request denied',
        404: 'Not found', 409: 'Drive original pending; operator recovery required',
        413: 'Original too large for bounded upload' })[status] ?? 'Service unavailable' });
    }
  } });
}
