import { PLANS, totalCents, type PaidPlanId, type PayCurrency } from '@quickreply/shared';

export const DECIMALS: Record<PayCurrency, number> = { USDT: 6, TON: 9 };

/** Formats base units with the currency's decimals, trimming trailing zeros (keeps at least 2). */
export function formatUnits(amount: bigint, currency: PayCurrency): string {
  const d = DECIMALS[currency];
  const s = amount.toString().padStart(d + 1, '0');
  const whole = s.slice(0, -d);
  let frac = s.slice(-d).replace(/0+$/, '');
  if (frac.length < 2) frac = frac.padEnd(2, '0');
  return `${whole}.${frac}`;
}

export interface Quote {
  usdCents: number;
  amount: bigint;
}

/**
 * Price in the payment currency's base units.
 * - USDT: 1 USD = 1 USDT (6 decimals).
 * - TON: converted at `tonUsd`, rounded UP to 0.001 TON so the merchant is never short.
 * `divisor` > 1 makes test-mode invoices cheap (testnet faucets give little TON).
 */
export function quote(plan: PaidPlanId, seats: number, currency: PayCurrency, tonUsd: number | null, divisor = 1): Quote {
  if (!PLANS[plan].perSeat && seats !== 1) throw new Error('Seats only apply to Business');
  const usdCents = totalCents(plan, seats);
  const cents = BigInt(Math.max(1, Math.ceil(usdCents / divisor)));
  if (currency === 'USDT') return { usdCents, amount: cents * 10_000n }; // 1 cent = 10_000 micro-USDT
  if (!tonUsd || !Number.isFinite(tonUsd) || tonUsd <= 0) throw new Error('TON rate unavailable');
  const nanoPerCent = 1e7 / tonUsd; // 1e9 nano per TON, 100 cents per USD
  const nano = BigInt(Math.ceil((Number(cents) * nanoPerCent) / 1e6)) * 1_000_000n; // round up to 0.001 TON
  return { usdCents, amount: nano };
}
