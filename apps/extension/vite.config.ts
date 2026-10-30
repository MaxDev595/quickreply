import { resolve } from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/** Extension pages (popup + dashboard). The content script has its own IIFE build. */
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  build: {
    outDir: process.env.QR_OUT_DIR ?? 'dist',
    emptyOutDir: true,
    target: 'chrome116',
    sourcemap: false,
    modulePreload: { polyfill: false },
    rollupOptions: {
      input: {
        popup: resolve(import.meta.dirname, 'popup.html'),
        dashboard: resolve(import.meta.dirname, 'dashboard.html'),
      },
    },
  },
});
