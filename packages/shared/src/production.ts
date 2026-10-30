/**
 * Production endpoints, shared by the website and the extension build.
 * `billingApi` is filled in by `apps/api/scripts/deploy-production.mjs` after the
 * billing Worker is deployed. While it's empty, paid plans show "Coming soon"
 * and the extension has no plans or limits.
 */
export const PRODUCTION = {
  siteUrl: 'https://quickreply-6fj.pages.dev',
  billingApi: 'https://quickreply-billing.lemiri-ai.workers.dev',
} as const;
