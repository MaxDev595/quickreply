import type { NextConfig } from 'next';

/**
 * Fully static export for Cloudflare Pages: `next build` writes plain HTML/CSS/JS
 * to `out/`. No Node runtime, adapters or edge functions are needed.
 */
const config: NextConfig = {
  output: 'export',
  trailingSlash: true,
  images: { unoptimized: true },
  transpilePackages: ['@quickreply/shared'],
  poweredByHeader: false,
  reactStrictMode: true,
};

export default config;
