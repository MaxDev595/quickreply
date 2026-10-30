/**
 * Plan status for this browser. Only active in builds made with VITE_BILLING_API
 * (TON testnet test mode). The Chrome Web Store build has no billing code paths.
 *
 * The extension never decides entitlements itself: it asks the billing API,
 * which settles on-chain payments and returns the current plan.
 */
import type { Entitlement } from '@quickreply/shared';

export const BILLING_API: string = import.meta.env.VITE_BILLING_API ?? '';
export const SITE_URL: string = import.meta.env.VITE_SITE_URL ?? 'http://localhost:3000';
export const billingEnabled = BILLING_API.length > 0;

const INSTALL_KEY = 'qr.installId';
const ENTITLEMENT_KEY = 'qr.entitlement';

/** Random id for this browser profile. Not linked to any personal data. */
export async function getInstallId(): Promise<string> {
  const raw = await chrome.storage.local.get(INSTALL_KEY);
  const existing = raw[INSTALL_KEY];
  if (typeof existing === 'string') return existing;
  const id = crypto.randomUUID();
  await chrome.storage.local.set({ [INSTALL_KEY]: id });
  return id;
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BILLING_API}${path}`, { ...init, headers: { 'Content-Type': 'application/json' } });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data;
}

export async function cachedEntitlement(): Promise<Entitlement | null> {
  const raw = await chrome.storage.local.get(ENTITLEMENT_KEY);
  return (raw[ENTITLEMENT_KEY] as Entitlement | undefined) ?? null;
}

export async function refreshEntitlement(): Promise<Entitlement> {
  const id = await getInstallId();
  const ent = await call<Entitlement>(`/v1/entitlement?installId=${id}`);
  await chrome.storage.local.set({ [ENTITLEMENT_KEY]: ent });
  return ent;
}

export async function activateLicense(licenseKey: string): Promise<Entitlement> {
  const ent = await call<Entitlement>('/v1/licenses/activate', {
    method: 'POST',
    body: JSON.stringify({ installId: await getInstallId(), licenseKey }),
  });
  await chrome.storage.local.set({ [ENTITLEMENT_KEY]: ent });
  return ent;
}

export async function checkoutUrl(): Promise<string> {
  return `${SITE_URL.replace(/\/$/, '')}/pricing/?install=${await getInstallId()}#checkout`;
}
