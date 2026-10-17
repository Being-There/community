import { planImageRenditions } from './image-renditions.mjs';

// Adapted from the existing browser image optimizer. No network or persistence.
// The caller must authorize and preserve the original before storing derivatives.
export async function encodeImageRenditions(original, {
  createImage = () => new Image(),
  createCanvas = () => document.createElement('canvas'),
  createObjectURL = blob => URL.createObjectURL(blob),
  revokeObjectURL = url => URL.revokeObjectURL(url)
} = {}) {
  if (!original || typeof original.size !== 'number' || original.size <= 0)
    throw new TypeError('A nonempty image blob is required');
  if (!['image/jpeg', 'image/webp'].includes(original.type))
    throw new TypeError('Unsupported original image format');
  const url = createObjectURL(original);
  let image;
  try {
    image = createImage();
    image.decoding = 'async';
    image.src = url;
    await image.decode();
    const plan = planImageRenditions(image.naturalWidth, image.naturalHeight);
    const outputs = {};
    for (const { name, width, height, targetBytes } of plan) {
      const canvas = createCanvas();
      canvas.width = width; canvas.height = height;
      try {
        const ctx = canvas.getContext('2d', { alpha: false });
        if (!ctx) throw new Error('Cannot create image canvas');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(image, 0, 0, width, height);
        let encoded = null;
        for (const quality of [0.9, 0.86, 0.82, 0.78]) {
          encoded = await new Promise((resolve, reject) =>
            canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Image encoding failed')), 'image/webp', quality));
          if (encoded.type !== 'image/webp') {
            encoded = await new Promise((resolve, reject) =>
              canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Image encoding failed')), 'image/jpeg', quality));
          }
          if (encoded.size <= targetBytes) break;
        }
        if (!encoded || !['image/webp', 'image/jpeg'].includes(encoded.type))
          throw new Error('Unsupported encoded image format');
        outputs[name] = encoded;
      } finally { canvas.width = 0; canvas.height = 0; }
    }
    return Object.freeze(outputs);
  } finally {
    if (image) image.src = '';
    revokeObjectURL(url);
  }
}
