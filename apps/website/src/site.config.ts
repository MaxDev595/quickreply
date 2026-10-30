/**
 * Launch settings. Fill these in before deploying — nothing here is invented.
 * - siteUrl: the production URL (used for canonical links, sitemap and Open Graph).
 * - chromeStoreUrl: the Chrome Web Store listing, once the extension is published.
 *   While it is empty the site shows an honest "Coming soon" state.
 * - contactEmail: a real support address. While empty, the contact page says so.
 */
export const siteConfig = {
  name: 'QuickReply',
  tagline: 'Type Less. Get More Done.',
  description:
    'QuickReply is a free Chrome text expander. Save the messages you type every day and insert them anywhere with short shortcuts like /hello.',
  siteUrl: process.env.SITE_URL ?? 'http://localhost:3000',
  chromeStoreUrl: process.env.NEXT_PUBLIC_CHROME_STORE_URL ?? '',
  contactEmail: process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? '',
  /**
   * Billing API base URL. Empty = paid plans are shown as "Coming soon" with no checkout.
   * Set it only for the TON testnet test mode until the paid features exist.
   */
  billingApi: process.env.NEXT_PUBLIC_BILLING_API ?? '',
  /** Last update of the Privacy Policy and Terms. */
  legalUpdated: 'October 29, 2026',
};
