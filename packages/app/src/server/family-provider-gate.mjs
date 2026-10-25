// Explicit authorization boundary for future family-owned provider operations.
// This is not a Drive connector, token store, job queue, or public HTTP route.
import { AccessError } from './sessions.mjs';
import { validateMembership, canReadMemory, requireOrganizer } from './family-policy.mjs';

const validId = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,80}$/.test(value);
const modes = new Set(['read', 'write', 'organizer']);

export function createFamilyProviderGate({ sessions, repository, appOrigin, loadToken, callProvider }) {
  if (new URL(appOrigin).origin !== appOrigin || !appOrigin.startsWith('https://') ||
      !sessions || typeof sessions.authenticate !== 'function' ||
      typeof sessions.requireMutation !== 'function' ||
      typeof sessions.requireRecentAuthentication !== 'function' ||
      !repository || typeof repository.getMembership !== 'function' ||
      typeof repository.getMemory !== 'function' ||
      typeof loadToken !== 'function' || typeof callProvider !== 'function')
    throw new TypeError('HTTPS, session authority, scoped repository and private provider adapters required');

  return Object.freeze({
    async run({ request, familyId, mode, memoryId = null, operation }) {
      if (!validId(familyId) || !modes.has(mode) || (memoryId !== null && !validId(memoryId)) ||
          typeof operation !== 'string' || !/^[a-z][a-z0-9_-]{0,63}$/.test(operation))
        throw new AccessError(404);
      const url = new URL(request.url);
      if (url.origin !== appOrigin || !url.pathname.startsWith('/api/families/' + familyId + '/'))
        throw new AccessError(404);
      if (mode === 'read' ? !['GET', 'HEAD'].includes(request.method) : request.method !== 'POST')
        throw new AccessError(405);

      // Check a live session and the CURRENT membership, not a queued or browser role claim.
      // A scoped contributor cannot execute a family-wide provider operation.
      async function authorize() {
        const principal = await sessions.authenticate(request);
        const membership = validateMembership(await repository.getMembership(principal.accountId, familyId), principal.accountId, familyId);
        if (mode !== 'read') sessions.requireMutation(request, principal, appOrigin);
        if (mode === 'organizer') {
          requireOrganizer(membership);
          sessions.requireRecentAuthentication(principal);
        }
        if (memoryId === null && membership.scope.kind !== 'family') throw new AccessError(404);
        if (memoryId !== null) {
          const memory = await repository.getMemory(familyId, memoryId);
          if (memory?.id !== memoryId || !canReadMemory(membership, memory)) throw new AccessError(404);
        }
        return principal;
      }

      const initial = await authorize();
      // Recheck after asynchronous identity/membership lookups, directly before
      // loading a family-owned token. Never load tokens for denied requests.
      const beforeToken = await authorize();
      if (beforeToken.accountId !== initial.accountId || beforeToken.sessionHash !== initial.sessionHash)
        throw new AccessError(401);
      const token = await loadToken({ familyId, operation });
      if (token == null) throw new AccessError(503);
      // A revocation during token retrieval must prevent the provider API call.
      const beforeProvider = await authorize();
      if (beforeProvider.accountId !== initial.accountId || beforeProvider.sessionHash !== initial.sessionHash)
        throw new AccessError(401);
      const result = await callProvider({ token, familyId, memoryId, operation });
      // Never return provider content if membership/session was revoked in-flight.
      const afterProvider = await authorize();
      if (afterProvider.accountId !== initial.accountId || afterProvider.sessionHash !== initial.sessionHash)
        throw new AccessError(401);
      return result;
    }
  });
}
