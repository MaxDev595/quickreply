// Builds the TEST-MODE extension (billing UI, TON testnet) into dist-testnet/.
// Cross-platform (Windows cmd has no ${VAR:-default}). Never upload this build to the Chrome Web Store.
import { execSync } from 'node:child_process';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const env = {
  ...process.env,
  QR_OUT_DIR: 'dist-testnet',
  VITE_BILLING_API: process.env.VITE_BILLING_API || 'http://127.0.0.1:8787',
  VITE_SITE_URL: process.env.VITE_SITE_URL || 'http://localhost:3000',
};
const run = (cmd) => execSync(cmd, { cwd: root, env, stdio: 'inherit' });
run('npx tsc -p tsconfig.json');
run('npx vite build');
run('npx vite build --config vite.content.config.ts');
run('node scripts/check-dist.mjs');
console.log(`Test-mode extension built in dist-testnet/ (API ${env.VITE_BILLING_API}, site ${env.VITE_SITE_URL})`);
