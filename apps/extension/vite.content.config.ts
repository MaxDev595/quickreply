import { resolve } from 'node:path';
import { defineConfig } from 'vite';

/**
 * Content scripts can't be ES modules, so the content script is bundled
 * separately as a single self-contained IIFE file.
 */
export default defineConfig({
  publicDir: false,
  build: {
    outDir: process.env.QR_OUT_DIR ?? 'dist',
    emptyOutDir: false,
    target: 'chrome116',
    sourcemap: false,
    lib: {
      entry: resolve(import.meta.dirname, 'src/content/index.ts'),
      formats: ['iife'],
      name: 'QuickReplyContent',
      fileName: () => 'content.js',
    },
  },
});
