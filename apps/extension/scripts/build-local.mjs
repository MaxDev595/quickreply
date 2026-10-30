// Builds the extension WITHOUT plans or limits into dist-local/, for the integration
// and QA suites (they create many snippets). Not for the Chrome Web Store.
import { execSync } from 'node:child_process';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const env = { ...process.env, QR_OUT_DIR: 'dist-local', VITE_BILLING_API: 'off' };
const run = (cmd) => execSync(cmd, { cwd: root, env, stdio: 'inherit' });
run('npx tsc -p tsconfig.json');
run('npx vite build');
run('npx vite build --config vite.content.config.ts');
run('node scripts/check-dist.mjs');
console.log('Local (no billing) extension built in dist-local/');
