import { existsSync } from 'node:fs';
import { defineConfig } from '@playwright/test';

/**
 * Integration tests run the real built extension code (dist/) in Chromium.
 * CHROMIUM_PATH can point to any Chromium/Chrome binary; otherwise Playwright's
 * bundled browser is used (`npx playwright install chromium`).
 */
const executablePath = process.env.CHROMIUM_PATH ?? (existsSync('/opt/chromium/chromium') ? '/opt/chromium/chromium' : undefined);

export default defineConfig({
  testDir: './e2e',
  testMatch: /.*\.spec\.ts/,
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: false,
  workers: 1, // tests share one storage backend
  retries: 0,
  timeout: 20_000,
  expect: { timeout: 4_000 },
  reporter: [['list']],
  use: {
    headless: true,
    viewport: { width: 1280, height: 800 },
    launchOptions: {
      executablePath,
      args: ['--no-sandbox'],
    },
  },
});
