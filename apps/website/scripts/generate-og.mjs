// Renders public/og.png (1200×630) and copies the brand icons. Run: npm run og
import { copyFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

const require = createRequire(import.meta.url);
const sharp = require(require.resolve('sharp', { paths: [resolve(import.meta.dirname, '../../extension')] }));

const root = resolve(import.meta.dirname, '..');
const pub = resolve(root, 'public');
await mkdir(pub, { recursive: true });

const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#FFFFFF"/>
  <rect x="0" y="0" width="1200" height="630" fill="#F8FAFC"/>
  <g transform="translate(88 96)">
    <rect width="64" height="64" rx="14" fill="#1F2937"/>
    <circle cx="29" cy="29" r="14" fill="none" stroke="#fff" stroke-width="8.4"/>
    <path d="M38 38 L51 52" stroke="#22C55E" stroke-width="8.4" stroke-linecap="round"/>
    <text x="84" y="44" font-family="Inter, Helvetica, Arial, sans-serif" font-size="34" font-weight="600" fill="#111827">QuickReply</text>
  </g>
  <text x="88" y="268" font-family="Inter, Helvetica, Arial, sans-serif" font-size="64" font-weight="700" letter-spacing="-2" fill="#111827">Stop typing the same</text>
  <text x="88" y="344" font-family="Inter, Helvetica, Arial, sans-serif" font-size="64" font-weight="700" letter-spacing="-2" fill="#111827">thing over and over.</text>
  <g transform="translate(88 420)">
    <rect width="132" height="52" rx="10" fill="#FFFFFF" stroke="#D1D5DB" stroke-width="2"/>
    <rect y="46" width="132" height="6" rx="3" fill="#D1D5DB"/>
    <text x="66" y="34" text-anchor="middle" font-family="Inter, Helvetica, Arial, sans-serif" font-size="24" font-weight="600" fill="#111827">/hello</text>
    <path d="M160 26 h48 m-14 -12 l14 12 l-14 12" stroke="#16A34A" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    <text x="232" y="35" font-family="Inter, Helvetica, Arial, sans-serif" font-size="26" fill="#64748B">Hello! Thank you for contacting us…</text>
  </g>
  <text x="88" y="560" font-family="Inter, Helvetica, Arial, sans-serif" font-size="24" fill="#64748B">Free text expander for Chrome. Your snippets stay in your browser.</text>
</svg>`;

await sharp(Buffer.from(svg)).png().toFile(resolve(pub, 'og.png'));
for (const size of [32, 128]) {
  await copyFile(resolve(root, `../extension/public/icons/icon-${size}.png`), resolve(pub, `icon-${size}.png`));
}
console.log('public/og.png, icon-32.png, icon-128.png');
