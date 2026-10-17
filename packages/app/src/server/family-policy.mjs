// Server-side policy for the approved first workflow; no profile/mode grants.
import { AccessError } from './sessions.mjs';
const id = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,80}$/.test(value);
export function validateMembership(membership, accountId, familyId) {
  if (!id(accountId) || !id(familyId) || membership?.accountId !== accountId || membership?.familyId !== familyId ||
      membership.state !== 'active' || !['organizer', 'contributor'].includes(membership.role)) throw new AccessError(404);
  const scope = membership.scope;
  if (!scope || !['family', 'memories'].includes(scope.kind) ||
      Object.keys(scope).some(key => !['kind', ...(scope.kind === 'memories' ? ['memoryIds'] : [])].includes(key)) ||
      (scope.kind === 'memories' && (!Array.isArray(scope.memoryIds) || scope.memoryIds.length > 10000 ||
        scope.memoryIds.some(value => !id(value)) || new Set(scope.memoryIds).size !== scope.memoryIds.length))) throw new AccessError(404);
  return Object.freeze({ accountId, familyId, role: membership.role,
    scope: Object.freeze(scope.kind === 'family' ? { kind: 'family' } : { kind: 'memories', memoryIds: Object.freeze([...scope.memoryIds]) }) });
}
export function canReadMemory(membership, memory) {
  return Boolean(memory && id(memory.id) && memory.familyId === membership.familyId &&
    (memory.retained === undefined || typeof memory.retained === 'boolean') &&
    (!memory.retained || membership.role === 'organizer') &&
    (membership.scope.kind === 'family' || membership.scope.memoryIds.includes(memory.id)));
}
export function requireOrganizer(membership) {
  if (membership.role !== 'organizer' || membership.scope.kind !== 'family') throw new AccessError(404);
}
