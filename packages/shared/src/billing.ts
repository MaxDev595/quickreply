/**
 * Plans and prices. Shared by the billing API, the website checkout and the
 * extension so the numbers can't drift apart.
 *
 * Crypto payments can't renew automatically, so every paid plan is a prepaid
 * period. Entitlements are decided on the server, never in the extension.
 */
export type PaidPlanId = 'pro_monthly' | 'pro_annual' | 'business_monthly';
export type PlanId = 'free' | PaidPlanId;
export type Tier = 'free' | 'pro' | 'business';
export type PayCurrency = 'USDT' | 'TON';

export interface PlanInfo {
  id: PlanId;
  tier: Tier;
  name: string;
  /** Price in US cents. For Business this is per seat. */
  priceCents: number;
  perSeat: boolean;
  periodDays: number;
  /** Devices one license can be activated on (Business: per seat). */
  devices: number;
  features: string[];
  recommended?: boolean;
}

export const PLANS: Record<PlanId, PlanInfo> = {
  free: {
    id: 'free',
    tier: 'free',
    name: 'Free',
    priceCents: 0,
    perSeat: false,
    periodDays: 0,
    devices: 1,
    features: ['Up to 5 snippets', 'Works on every website', 'Variables and fill-in fields', 'Import and export'],
  },
  pro_monthly: {
    id: 'pro_monthly',
    tier: 'pro',
    name: 'Pro Monthly',
    priceCents: 399,
    perSeat: false,
    periodDays: 30,
    devices: 3,
    features: ['Unlimited snippets', 'One license for up to 3 browsers', 'Cloud sync (coming soon)', 'Version history (coming soon)'],
  },
  pro_annual: {
    id: 'pro_annual',
    tier: 'pro',
    name: 'Pro Annual',
    priceCents: 2900,
    perSeat: false,
    periodDays: 365,
    devices: 3,
    features: ['Everything in Pro Monthly', 'Save 39%'],
    recommended: true,
  },
  business_monthly: {
    id: 'business_monthly',
    tier: 'business',
    name: 'Business',
    priceCents: 799,
    perSeat: true,
    periodDays: 30,
    devices: 1,
    features: ['Unlimited snippets for every member', 'One license key for the team', 'Shared libraries and roles (coming soon)'],
  },
};

export const PAID_PLANS: PaidPlanId[] = ['pro_monthly', 'pro_annual', 'business_monthly'];
export const MAX_SEATS = 500;

/** Snippets a Free library can grow to. Existing snippets over the limit keep working. */
export const FREE_SNIPPET_LIMIT = 5;

/** Paid entitlement that hasn't expired yet. */
export function hasPaidAccess(ent: Entitlement | null | undefined, now = Date.now()): boolean {
  return !!ent && ent.tier !== 'free' && (ent.expiresAt === null || ent.expiresAt > now);
}

/** Maximum number of snippets for this entitlement (Infinity for paid plans). */
export function snippetLimit(ent: Entitlement | null | undefined, now = Date.now()): number {
  return hasPaidAccess(ent, now) ? Infinity : FREE_SNIPPET_LIMIT;
}

/**
 * Whether a library change from `before` to `after` snippets is allowed under `limit`.
 * Growing past the limit is blocked; libraries already over it (made before limits
 * existed, or after a plan ran out) are kept and may shrink or be edited.
 */
export function withinSnippetLimit(before: number, after: number, limit: number): boolean {
  return after <= limit || after <= before;
}

export function isPaidPlan(id: unknown): id is PaidPlanId {
  return typeof id === 'string' && (PAID_PLANS as string[]).includes(id);
}

export function totalCents(plan: PaidPlanId, seats: number): number {
  const p = PLANS[plan];
  return p.perSeat ? p.priceCents * seats : p.priceCents;
}

export function formatUsd(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

/** What the server returns for an install or license. */
export interface Entitlement {
  tier: Tier;
  plan: PlanId;
  seats: number;
  /** Epoch ms; null for Free. */
  expiresAt: number | null;
  licenseKey: string | null;
  /** True when the API runs against TON testnet. */
  testMode: boolean;
}

export type InvoiceStatus = 'pending' | 'paid' | 'expired';

export interface InvoiceView {
  id: string;
  plan: PaidPlanId;
  seats: number;
  currency: PayCurrency;
  /** Amount in the currency's base units (USDT: 6 decimals, TON: nanotons), as a string. */
  amount: string;
  /** Human amount, e.g. "3.99" USDT or "1.234567890" TON. */
  amountDisplay: string;
  usdCents: number;
  payTo: string;
  comment: string;
  /** ton://transfer link for wallets. */
  link: string;
  status: InvoiceStatus;
  expiresAt: number;
  testMode: boolean;
  licenseKey: string | null;
}
