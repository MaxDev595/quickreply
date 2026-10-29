import { mkdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import react from '@vitejs/plugin-react';
import { build } from 'vite';
import { startHarness } from './harness/server';
import { HARNESS_PORT, STORE_FILE } from './helpers';

export default async function globalSetup() {
  const root = resolve(import.meta.dirname, '..');
  // React fixture bundle (real React 19 controlled inputs).
  await build({
    configFile: false,
    logLevel: 'error',
    plugins: [react()],
    define: { 'process.env.NODE_ENV': '"production"' },
    build: {
      outDir: resolve(root, 'e2e/.fixtures-build'),
      emptyOutDir: true,
      lib: { entry: resolve(root, 'e2e/fixtures/react-app.tsx'), formats: ['iife'], name: 'Fixture', fileName: () => 'react-app.js' },
    },
  });
  await mkdir(resolve(STORE_FILE, '..'), { recursive: true });
  await rm(STORE_FILE, { force: true });
  const harness = await startHarness(HARNESS_PORT, STORE_FILE);
  return async () => harness.close();
}
