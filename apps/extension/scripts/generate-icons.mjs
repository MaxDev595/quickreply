// Renders the extension icons from the SVG sources. Run: npm run icons
import { mkdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import sharp from 'sharp';

const root = resolve(import.meta.dirname, '..');
const large = await readFile(resolve(root, 'assets/logo.svg'));
const small = await readFile(resolve(root, 'assets/logo-small.svg'));
const outDir = resolve(root, 'public/icons');
await mkdir(outDir, { recursive: true });

// Small sizes use a simplified mark with thicker strokes so it stays legible.
const sizes = [
  [16, small],
  [32, small],
  [48, large],
  [128, large],
];
for (const [size, svg] of sizes) {
  await sharp(svg, { density: 72 * Math.ceil(size / 32) * 4 })
    .resize(size, size)
    .png()
    .toFile(resolve(outDir, `icon-${size}.png`));
  console.log(`icons/icon-${size}.png`);
}
