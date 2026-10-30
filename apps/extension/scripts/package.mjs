// Zips dist/ into release/quickreply-extension-v<version>.zip for the Chrome Web Store.
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const dist = resolve(root, process.env.QR_OUT_DIR ?? 'dist');
const { version } = JSON.parse(await readFile(resolve(dist, 'manifest.json'), 'utf8'));
const releaseDir = resolve(root, '../../release');
const suffix = process.env.QR_ZIP_SUFFIX ? `-${process.env.QR_ZIP_SUFFIX}` : '';
const zipPath = resolve(releaseDir, `quickreply-extension-v${version}${suffix}.zip`);

await mkdir(releaseDir, { recursive: true });
await rm(zipPath, { force: true });
// -X strips extra file attributes so the archive is reproducible.
execFileSync('zip', ['-r', '-X', '-q', zipPath, '.'], { cwd: dist, stdio: 'inherit' });
console.log(`Created ${zipPath}`);
