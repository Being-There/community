// Shared photo validation and derivatives for browser uploads and trusted folder intake.
// Exact original bytes are never altered. No identity or permission logic here.
import sharp from 'sharp';
import { planImageRenditions } from '../core/image-renditions.mjs';

export async function preparePhoto(bytes) {
  if (!(bytes instanceof Uint8Array) || !bytes.length || bytes.length > 14 * 1024 * 1024) throw new TypeError('Unsupported photo size');
  const original = Buffer.from(bytes);
  let metadata;
  try { metadata = await sharp(original, { limitInputPixels: 40000000, failOn: 'error' }).metadata(); }
  catch { throw new TypeError('Invalid image'); }
  if (!['jpeg', 'png', 'webp'].includes(metadata.format) || !metadata.width || !metadata.height ||
      metadata.width * metadata.height > 40000000 || (metadata.pages ?? 1) > 1) throw new TypeError('Unsupported image');
  // Validate the whole input rather than just trusting an image header.
  try { await sharp(original, { limitInputPixels: 40000000, failOn: 'error' }).stats(); }
  catch { throw new TypeError('Invalid image pixels'); }
  const swapped = [5, 6, 7, 8].includes(metadata.orientation);
  const derivatives = [];
  for (const plan of planImageRenditions(swapped ? metadata.height : metadata.width, swapped ? metadata.width : metadata.height)) {
    let output;
    for (const quality of [90, 86, 82, 78]) {
      output = await sharp(original, { limitInputPixels: 40000000 }).rotate().flatten({ background: '#ffffff' })
        .resize(plan.width, plan.height, { fit: 'inside', withoutEnlargement: true }).webp({ quality }).toBuffer();
      if (output.length <= plan.targetBytes) break;
    }
    const dimensions = await sharp(output).metadata();
    derivatives.push({ name: plan.name, width: dimensions.width, height: dimensions.height, bytes: output });
  }
  return { bytes: original, derivatives };
}
