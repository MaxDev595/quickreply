import { existsSync } from 'node:fs';
import { defineConfig } from '@playwright/test';

const executablePath = process.env.CHROMIUM_PATH ?? (existsSync('/opt/chromium/chromium') ? '/opt/chromium/chromium' : undefined);

export default defineConfig({
  testDir: './e2e',
  timeout: 20_000,
  reporter: [['list']],
  webServer: { command: 'node scripts/serve-out.mjs', port: 4790, reuseExistingServer: true },
  use: {
    baseURL: 'http://localhost:4790',
    headless: true,
    launchOptions: { executablePath, args: ['--no-sandbox'] },
  },
});
