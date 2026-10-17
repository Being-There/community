// Pure rendition planning adapted from the existing browser image optimizer.
// Original media is never modified; this module performs no upload or access checks.
export const IMAGE_RENDITIONS = Object.freeze([
  Object.freeze({ name: 'small', maxDimension: 640, targetBytes: 170 * 1024 }),
  Object.freeze({ name: 'medium', maxDimension: 1280, targetBytes: 450 * 1024 }),
  Object.freeze({ name: 'large', maxDimension: 2560, targetBytes: 1000 * 1024 })
]);
export const MAX_DECODE_PIXELS = 40_000_000;
export function planImageRenditions(width, height) {
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) ||
      width < 1 || height < 1 || width * height > MAX_DECODE_PIXELS)
    throw new RangeError('Image dimensions unavailable or too large to resize safely');
  return IMAGE_RENDITIONS.map(({ name, maxDimension, targetBytes }) => {
    const scale = Math.min(1, maxDimension / Math.max(width, height));
    return Object.freeze({
      name,
      width: Math.max(1, Math.round(width * scale)),
      height: Math.max(1, Math.round(height * scale)),
      targetBytes
    });
  });
}
export function validateRendition(blob, expectedName) {
  if (!IMAGE_RENDITIONS.some(x => x.name === expectedName)) return false;
  return Boolean(blob && ['image/webp', 'image/jpeg'].includes(blob.type) &&
    Number.isSafeInteger(blob.size) && blob.size > 0);
}
