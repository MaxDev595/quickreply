import { defineConfig } from '@playwright/test';

/**
 * Real-extension QA suite: full Chromium + unpacked dist/, no API shims.
 * Requires a full Chromium/Chrome for Testing binary (CHROME_PATH). Google's
 * branded Chrome 137+ ignores --load-extension, so use Chromium or Chrome for Testing.
 */
export default defineConfig({
  testDir: './e2e-real',
  testMatch: /.*\.spec\.ts/,
  workers: 1,
  timeout: 45_000,
  expect: { timeout: 5_000 },
  reporter: [['list'], ['json', { outputFile: 'test-results/real-results.json' }]],
  webServer: { command: 'node ../../qa/serve.mjs', port: 4795, reuseExistingServer: true },
});
