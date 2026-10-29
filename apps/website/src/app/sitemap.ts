import type { MetadataRoute } from 'next';
import { siteConfig } from '@/site.config';

export const dynamic = 'force-static';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteConfig.siteUrl.replace(/\/$/, '');
  return [
    { url: `${base}/`, changeFrequency: 'weekly', priority: 1 },
    { url: `${base}/privacy/`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${base}/terms/`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${base}/contact/`, changeFrequency: 'yearly', priority: 0.2 },
  ];
}
