// Zips dist/ into release/quickreply-extension-v<version>.zip for the Chrome Web Store.
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const dist = resolve(root, 'dist');
const { version } = JSON.parse(await readFile(resolve(dist, 'manifest.json'), 'utf8'));
const releaseDir = resolve(root, '../../release');
const zipPath = resolve(releaseDir, `quickreply-extension-v${version}.zip`);

await mkdir(releaseDir, { recursive: true });
await rm(zipPath, { force: true });
// -X strips extra file attributes so the archive is reproducible.
execFileSync('zip', ['-r', '-X', '-q', zipPath, '.'], { cwd: dist, stdio: 'inherit' });
console.log(`Created ${zipPath}`);
