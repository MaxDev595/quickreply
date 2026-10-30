// Post-build safety checks for the Chrome Web Store package.
import { readFile, readdir, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const dist = resolve(import.meta.dirname, '..', process.env.QR_OUT_DIR ?? 'dist');
const errors = [];

const manifest = JSON.parse(await readFile(join(dist, 'manifest.json'), 'utf8'));
const required = ['popup.html', 'dashboard.html', 'content.js', ...Object.values(manifest.icons)];
for (const file of required) {
  try {
    await stat(join(dist, file));
  } catch {
    errors.push(`Missing ${file}`);
  }
}
if (manifest.manifest_version !== 3) errors.push('manifest_version must be 3');
const allowedPermissions = new Set(['storage']);
for (const p of manifest.permissions ?? []) if (!allowedPermissions.has(p)) errors.push(`Unexpected permission: ${p}`);
if (manifest.host_permissions?.length) errors.push('Unexpected host_permissions');

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    out.push(...(entry.isDirectory() ? await walk(p) : [p]));
  }
  return out;
}

for (const file of await walk(dist)) {
  if (!/\.(js|html)$/.test(file)) continue;
  const code = await readFile(file, 'utf8');
  if (/\beval\s*\(/.test(code)) errors.push(`eval() found in ${file}`);
  if (/new Function\s*\(/.test(code)) errors.push(`new Function() found in ${file}`);
  if (/<script[^>]+src=["']https?:/i.test(code)) errors.push(`Remote script in ${file}`);
  if (/import\(\s*["']https?:/.test(code)) errors.push(`Remote import in ${file}`);
}

const content = await readFile(join(dist, 'content.js'), 'utf8');
if (/^\s*(import|export)\s/m.test(content)) errors.push('content.js must not contain ES module syntax');
if (/\.innerHTML\s*=/.test(content)) errors.push('content.js must not assign innerHTML');

if (errors.length) {
  console.error(`dist check failed:\n- ${errors.join('\n- ')}`);
  process.exit(1);
}
console.log(`dist check passed (${(content.length / 1024).toFixed(1)} KB content script)`);
