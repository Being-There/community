// Portable adaptation of the existing person/place/event story links.
// Metadata only. Caller must authorize family membership before using or persisting.
const validId = v => typeof v === 'string' && /^[A-Za-z0-9_-]{1,80}$/.test(v);
const kinds = new Set(['person', 'place', 'event']);
export function createStoryEntity({ id, familyId, kind, name, contributorId }) {
  if (![id, familyId, contributorId].every(validId) || !kinds.has(kind) ||
      typeof name !== 'string') throw new TypeError('Invalid story entity');
  const normalizedName = name.trim().replace(/\s+/g, ' ');
  if (!normalizedName || normalizedName.length > 100)
    throw new TypeError('Invalid entity name');
  return Object.freeze({ id, familyId, kind, name: normalizedName, contributorId });
}
export function entityDeduplicationKey(entity) {
  if (!entity || !validId(entity.familyId) || !kinds.has(entity.kind) ||
      typeof entity.name !== 'string' || !entity.name.trim())
    throw new TypeError('Invalid story entity');
  return JSON.stringify([entity.familyId, entity.kind, entity.name.trim().replace(/\s+/g, ' ').toLowerCase()]);
}
export function createStoryEntityLink({ story, entity, addedBy }) {
  if (!story || !entity || !validId(story.id) || !validId(entity.id) ||
      !validId(story.familyId) || story.familyId !== entity.familyId ||
      !validId(addedBy)) throw new TypeError('Cross-family or invalid story link');
  return Object.freeze({
    familyId: story.familyId, storyId: story.id, entityId: entity.id, addedBy
  });
}
export function selectStoryGraph({ familyId, stories, entities, links }) {
  if (!validId(familyId) || ![stories, entities, links].every(Array.isArray))
    throw new TypeError('Invalid graph input');
  const storyIds = new Set(stories.filter(s => s?.familyId === familyId && validId(s.id)).map(s => s.id));
  const selectedEntities = entities.filter(e => e?.familyId === familyId && validId(e.id));
  const entityIds = new Set(selectedEntities.map(e => e.id));
  return Object.freeze({
    entities: Object.freeze([...selectedEntities]),
    links: Object.freeze(links.filter(l => l?.familyId === familyId &&
      storyIds.has(l.storyId) && entityIds.has(l.entityId)).map(l => Object.freeze({ ...l })))
  });
}
