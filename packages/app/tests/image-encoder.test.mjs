import test from 'node:test';
import assert from 'node:assert/strict';
import { encodeImageRenditions } from '../src/core/image-encoder.mjs';

function harness({ width = 4000, height = 3000, webp = true } = {}) {
  const calls = [];
  const revoked = [];
  const image = { naturalWidth: width, naturalHeight: height, decode: async () => {}, src: '' };
  return {
    calls, revoked, image,
    dependencies: {
      createImage: () => image,
      createObjectURL: () => 'blob:synthetic',
      revokeObjectURL: url => revoked.push(url),
      createCanvas: () => {
        const canvas = {
          width: 0, height: 0,
          getContext: () => ({
            fillRect() {}, drawImage() {}, fillStyle: '', imageSmoothingEnabled: false, imageSmoothingQuality: ''
          }),
          toBlob(cb, type, quality) {
            calls.push({ width: canvas.width, height: canvas.height, type, quality });
            cb({ type: webp && type === 'image/webp' ? type : 'image/jpeg', size: 120 });
          }
        };
        return canvas;
      }
    }
  };
}
test('encodes three existing image variants with expected dimensions and cleans up URL', async () => {
  const h = harness();
  const result = await encodeImageRenditions({ type: 'image/jpeg', size: 5000 }, h.dependencies);
  assert.deepEqual(Object.keys(result), ['small', 'medium', 'large']);
  assert.deepEqual(h.calls.map(c => [c.width, c.height]), [[640, 480], [1280, 960], [2560, 1920]]);
  assert.deepEqual(h.revoked, ['blob:synthetic']);
  assert.equal(h.image.src, '');
});
test('falls back to JPEG when WebP unsupported', async () => {
  const h = harness({ webp: false });
  const result = await encodeImageRenditions({ type: 'image/webp', size: 1000 }, h.dependencies);
  assert.equal(result.small.type, 'image/jpeg');
  assert.equal(h.calls.filter(c => c.type === 'image/jpeg').length, 3);
});
test('rejects oversized decoded images and releases resources', async () => {
  const h = harness({ width: 10000, height: 10000 });
  await assert.rejects(encodeImageRenditions({ type: 'image/jpeg', size: 1000 }, h.dependencies), RangeError);
  assert.deepEqual(h.revoked, ['blob:synthetic']);
});
test('rejects unsupported or empty input before decoding', async () => {
  const h = harness();
  await assert.rejects(encodeImageRenditions({ type: 'image/png', size: 100 }, h.dependencies), TypeError);
  await assert.rejects(encodeImageRenditions({ type: 'image/jpeg', size: 0 }, h.dependencies), TypeError);
  assert.deepEqual(h.calls, []);
});
