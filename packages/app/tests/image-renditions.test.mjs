import test from 'node:test';
import assert from 'node:assert/strict';
import { IMAGE_RENDITIONS, MAX_DECODE_PIXELS, planImageRenditions, validateRendition } from '../src/core/image-renditions.mjs';

test('preserves existing small medium large rendition policy', () => {
  assert.deepEqual(IMAGE_RENDITIONS.map(x => [x.name, x.maxDimension, x.targetBytes]), [
    ['small', 640, 174080], ['medium', 1280, 460800], ['large', 2560, 1024000]
  ]);
  assert.deepEqual(planImageRenditions(4000, 3000).map(x => [x.width, x.height]), [
    [640, 480], [1280, 960], [2560, 1920]
  ]);
});
test('never upscales smaller originals', () => {
  assert.deepEqual(planImageRenditions(320, 200).map(x => [x.width, x.height]), [
    [320, 200], [320, 200], [320, 200]
  ]);
});
test('rejects unsafe dimensions and unsupported renditions', () => {
  for (const dimensions of [[0, 100], [-1, 10], [1.2, 5], [10000, 10000], [Infinity, 10]]) {
    assert.throws(() => planImageRenditions(...dimensions), RangeError);
  }
  assert.equal(MAX_DECODE_PIXELS, 40_000_000);
  assert.equal(validateRendition({ type: 'image/webp', size: 120 }, 'small'), true);
  assert.equal(validateRendition({ type: 'image/png', size: 120 }, 'small'), false);
  assert.equal(validateRendition({ type: 'image/jpeg', size: 0 }, 'large'), false);
  assert.equal(validateRendition({ type: 'image/jpeg', size: 100 }, 'other'), false);
});
