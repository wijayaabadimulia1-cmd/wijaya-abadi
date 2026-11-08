import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourcePath = path.join(root, 'public', 'favicon-honda.jpg');
const sourceSize = 512;
const { data, info } = await sharp(sourcePath)
  .resize(sourceSize, sourceSize, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 1 } })
  .removeAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });
const rgba = Buffer.alloc(sourceSize * sourceSize * 4);

for (let sourceOffset = 0, targetOffset = 0; sourceOffset < data.length; sourceOffset += info.channels, targetOffset += 4) {
  const red = data[sourceOffset];
  const green = data[sourceOffset + 1];
  const blue = data[sourceOffset + 2];
  const minimum = Math.min(red, green, blue);
  const alpha = 255 - minimum;
  if (alpha < 16) continue;

  rgba[targetOffset] = Math.min(255, Math.round(((red - minimum) * 255) / alpha));
  rgba[targetOffset + 1] = Math.min(255, Math.round(((green - minimum) * 255) / alpha));
  rgba[targetOffset + 2] = Math.min(255, Math.round(((blue - minimum) * 255) / alpha));
  rgba[targetOffset + 3] = alpha;
}

const sizes = [
  ['favicon-honda-32.png', 32],
  ['favicon-honda-192.png', 192],
  ['apple-touch-icon.png', 180],
  ['favicon-honda.png', 512],
];

await Promise.all(sizes.map(([fileName, size]) => sharp(rgba, {
  raw: { width: sourceSize, height: sourceSize, channels: 4 },
}).resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toFile(path.join(root, 'public', fileName))));

console.log(`Generated ${sizes.length} transparent Honda icons from public/favicon-honda.jpg`);