import test from 'node:test';
import assert from 'node:assert/strict';
import { createStoryEntity, entityDeduplicationKey, createStoryEntityLink, selectStoryGraph } from '../src/core/story-graph.mjs';

const story = familyId => ({ id: 'story1', familyId });
const entity = (familyId, name = '  North   Park  ') => createStoryEntity({
  id: 'entity1', familyId, kind: 'place', name, contributorId: 'contributor1'
});
test('normalizes entity names and deduplicates only within a family and kind', () => {
  const a = entity('familyA');
  const b = entity('familyA', 'north park');
  const c = entity('familyB', 'north park');
  assert.equal(a.name, 'North Park');
  assert.equal(entityDeduplicationKey(a), entityDeduplicationKey(b));
  assert.notEqual(entityDeduplicationKey(a), entityDeduplicationKey(c));
});
test('links stories and entities only inside same family', () => {
  const a = entity('familyA');
  const link = createStoryEntityLink({ story: story('familyA'), entity: a, addedBy: 'contributor1' });
  assert.equal(link.familyId, 'familyA');
  assert.throws(() => createStoryEntityLink({ story: story('familyB'), entity: a, addedBy: 'contributor1' }), /Cross-family/);
});
test('filters unrelated family and dangling graph edges', () => {
  const a = entity('familyA');
  const b = entity('familyB');
  const link = createStoryEntityLink({ story: story('familyA'), entity: a, addedBy: 'contributor1' });
  const result = selectStoryGraph({
    familyId: 'familyA', stories: [story('familyA'), story('familyB')],
    entities: [a, b], links: [link, { ...link, entityId: 'missing' }, { ...link, familyId: 'familyB' }]
  });
  assert.deepEqual(result.entities, [a]);
  assert.deepEqual(result.links, [link]);
});
test('rejects invalid entity names and unsupported kinds', () => {
  assert.throws(() => entity('familyA', '   '), TypeError);
  assert.throws(() => createStoryEntity({ id: 'e', familyId: 'f', kind: 'unknown', name: 'X', contributorId: 'c' }), TypeError);
});
