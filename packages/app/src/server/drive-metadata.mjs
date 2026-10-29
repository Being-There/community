// Immutable, readable metadata-only snapshots in the organizer's private Drive folder.
// Original media bytes are NOT included: this is not yet a complete Drive backup.
import { createHash, randomUUID } from 'node:crypto';
import { OAuth2Client } from 'google-auth-library';
import { AccessError } from './sessions.mjs';
import { validateMembership, requireOrganizer } from './family-policy.mjs';
import { validateArchiveContent, ARCHIVE_LIMITS } from '../core/family-archive.mjs';

const scope = 'https://www.googleapis.com/auth/drive.file';
const uploadUrl = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,parents';
const common = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer', Vary: 'Cookie' };
const json = (status, value) => new Response(JSON.stringify(value), { status,
  headers: { ...common, 'Content-Type': 'application/json; charset=utf-8' } });

export function createDriveMetadata({ sessions, repository, appOrigin, clientId, clientSecret,
  refreshAccessToken, driveFetch = fetch }) {
  if (!appOrigin?.startsWith('https://') || new URL(appOrigin).origin !== appOrigin ||
      !clientId || !clientSecret || !sessions || !repository ||
      ['getMembership', 'getAccount', 'getDriveCredential', 'getDriveFolder',
        'snapshotDriveMetadata', 'getDriveMetadata', 'reserveDriveMetadata',
        'finishDriveMetadata'].some(name => typeof repository[name] !== 'function') ||
      typeof driveFetch !== 'function' ||
      (refreshAccessToken !== undefined && typeof refreshAccessToken !== 'function'))
    throw new TypeError('Private family repository, verified sessions and HTTPS origin required');

  const refresh = refreshAccessToken ?? (async refreshToken => {
    const oauth = new OAuth2Client({ clientId, clientSecret });
    oauth.setCredentials({ refresh_token: refreshToken });
    return (await oauth.getAccessToken())?.token;
  });

  return Object.freeze({ async handle(request) {
    try {
      const url = new URL(request.url);
      const match = /^\/api\/families\/([A-Za-z0-9_-]{1,80})\/drive\/metadata$/.exec(url.pathname);
      if (url.origin !== appOrigin || !match || url.search || request.method !== 'POST')
        throw new AccessError(404);
      const familyId = match[1];

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

      // Read only family-scoped metadata after authorization; never include accounts,
      // memberships, invitations, sessions, OAuth credentials or original bytes.
      const content = validateArchiveContent(
        repository.snapshotDriveMetadata(second.principal, familyId), familyId);
      const bytes = Buffer.from(JSON.stringify({
        format: 'being-there.drive-metadata', version: 1, content
      }), 'utf8');
      if (bytes.length > ARCHIVE_LIMITS.metadataBytes) throw new AccessError(413);
      const digest = createHash('sha256').update(bytes).digest('hex');
      const name = 'being-there-metadata-' + digest + '.json';

      const credential = repository.getDriveCredential(second.principal, familyId);
      if (!credential || credential.scope !== scope || credential.subject !== first.subject)
        throw new AccessError(404);
      const folder = repository.getDriveFolder(second.principal, familyId);
      if (folder?.state !== 'ready') throw new AccessError(folder ? 409 : 404);
      const previous = repository.getDriveMetadata(second.principal, familyId, digest, credential, folder.id);
      if (previous?.state === 'ready') return json(200, { fileId: previous.id, sha256: digest, created: false });
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
        return latest.principal;
      }
      const principal = await stillAuthorized();
      const claim = repository.reserveDriveMetadata(principal, familyId, digest, credential, folder.id);
      await stillAuthorized();

      const boundary = 'bt_' + randomUUID().replaceAll('-', '');
      const metadata = JSON.stringify({ name, mimeType: 'application/json', parents: [folder.id] });
      const body = Buffer.concat([
        Buffer.from('--' + boundary + '\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n' +
          metadata + '\r\n--' + boundary + '\r\nContent-Type: application/json\r\n\r\n'),
        bytes, Buffer.from('\r\n--' + boundary + '--\r\n')
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
          result.name !== name || result.mimeType !== 'application/json' ||
          !Array.isArray(result.parents) || result.parents.length !== 1 ||
          result.parents[0] !== folder.id) throw new AccessError(503);
      // A completed provider request cannot be undone; never acknowledge it after revocation.
      const final = await stillAuthorized();
      repository.finishDriveMetadata(final, familyId, digest, credential, folder.id, claim, result.id);
      return json(201, { fileId: result.id, sha256: digest, created: true });
    } catch (error) {
      const status = error instanceof AccessError ? error.status : 503;
      return json(status, { error: ({ 401: 'Sign in required', 403: 'Request denied',
        404: 'Not found', 409: 'Drive write pending; operator recovery required',
        413: 'Metadata exceeds safe upload limit' })[status] ?? 'Service unavailable' });
    }
  } });
}
