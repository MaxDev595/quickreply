import { describe, expect, it } from 'vitest';
import { parseAddress, sameAddress, toFriendly, toRaw } from '../src/address';
import { matchPayments, type OpenInvoice, type TonApiEvent } from '../src/match';
import { formatUnits, quote } from '../src/pricing';

const WALLET = 'UQDAN7augBPM8Vtpcxl5fVa_Zw33vTA0FfuIOlJh5TCT6_sS';
const WALLET_RAW = '0:c037b6ae8013ccf15b697319797d56bf670df7bd303415fb883a5261e53093eb';
const USDT = 'EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs';
const PAYER = '0:1111111111111111111111111111111111111111111111111111111111111111';
const FAKE_MASTER = '0:2222222222222222222222222222222222222222222222222222222222222222';

describe('TON addresses', () => {
  it('parses the receiving wallet and verifies its checksum', () => {
    expect(toRaw(WALLET)).toBe(WALLET_RAW);
    expect(parseAddress(WALLET)).toMatchObject({ workchain: 0, bounceable: false, testnetOnly: false });
  });

  it('matches raw (any case) and friendly forms of the same address', () => {
    expect(sameAddress(WALLET, WALLET_RAW.toUpperCase())).toBe(true);
    expect(sameAddress(WALLET, PAYER)).toBe(false);
    expect(sameAddress(WALLET, undefined)).toBe(false);
    expect(sameAddress('garbage', WALLET)).toBe(false);
  });

  it('round-trips friendly forms, including testnet', () => {
    expect(toFriendly(WALLET_RAW, { bounceable: false, testnet: false })).toBe(WALLET);
    const testnet = toFriendly(WALLET, { bounceable: false, testnet: true });
    expect(testnet.startsWith('0Q')).toBe(true);
    expect(parseAddress(testnet).testnetOnly).toBe(true);
    expect(toRaw(testnet)).toBe(WALLET_RAW);
    expect(toRaw(USDT)).toMatch(/^0:[0-9a-f]{64}$/);
  });

  it('rejects a corrupted address', () => {
    const broken = WALLET.slice(0, -1) + (WALLET.endsWith('S') ? 'T' : 'S');
    expect(() => parseAddress(broken)).toThrow(/checksum/);
    expect(() => parseAddress('UQ123')).toThrow();
  });
});

describe('pricing', () => {
  it('USDT is 1:1 with USD in 6 decimals', () => {
    expect(quote('pro_monthly', 1, 'USDT', null)).toEqual({ usdCents: 399, amount: 3_990_000n });
    expect(quote('pro_annual', 1, 'USDT', null).amount).toBe(29_000_000n);
  });

  it('Business is priced per seat', () => {
    expect(quote('business_monthly', 12, 'USDT', null)).toEqual({ usdCents: 9588, amount: 95_880_000n });
    expect(() => quote('pro_monthly', 2, 'USDT', null)).toThrow(/Seats/);
  });

  it('TON converts at the rate and rounds UP to 0.001 TON', () => {
    const { amount } = quote('pro_monthly', 1, 'TON', 3.2);
    // 3.99 / 3.2 = 1.246875 TON → 1.247 TON
    expect(amount).toBe(1_247_000_000n);
    expect(amount % 1_000_000n).toBe(0n);
    expect(() => quote('pro_monthly', 1, 'TON', null)).toThrow(/rate/);
  });

  it('test-mode divisor makes invoices cheap but never zero', () => {
    expect(quote('pro_monthly', 1, 'USDT', null, 100).amount).toBe(40_000n); // ceil(3.99) cents
    expect(quote('pro_monthly', 1, 'TON', 3.2, 100000).amount).toBeGreaterThan(0n);
  });

  it('formats base units for people', () => {
    expect(formatUnits(3_990_000n, 'USDT')).toBe('3.99');
    expect(formatUnits(1_247_000_000n, 'TON')).toBe('1.247');
    expect(formatUnits(40_000n, 'USDT')).toBe('0.04');
    expect(formatUnits(5_000_000_000n, 'TON')).toBe('5.00');
  });
});

describe('payment matching', () => {
  const t0 = 1_793_300_000_000;
  const inv = (over: Partial<OpenInvoice> = {}): OpenInvoice => ({
    id: 'inv-1',
    comment: 'QR-ABCD2345',
    currency: 'TON',
    amount: 1_247_000_000n,
    createdAt: t0,
    expiresAt: t0 + 3_600_000,
    ...over,
  });
  const tonEvent = (over: Partial<TonApiEvent> = {}, action: Record<string, unknown> = {}): TonApiEvent => ({
    event_id: 'ev-1',
    timestamp: Math.floor((t0 + 60_000) / 1000),
    lt: 100,
    in_progress: false,
    actions: [
      {
        type: 'TonTransfer',
        status: 'ok',
        TonTransfer: { sender: { address: PAYER }, recipient: { address: WALLET_RAW.toUpperCase() }, amount: 1_247_000_000, comment: 'QR-ABCD2345', ...action },
      },
    ],
    ...over,
  });
  const OUR_JW = '0:' + 'a'.repeat(64);
  const FAKE_JW = '0:' + 'b'.repeat(64);
  const usdtEvent = (master: string, amount = '3990000', comment = 'QR-USDT2345', recipientsWallet = OUR_JW): TonApiEvent => ({
    event_id: `ev-usdt-${master.slice(-4)}-${amount}`,
    timestamp: Math.floor((t0 + 60_000) / 1000),
    lt: 200,
    in_progress: false,
    actions: [
      {
        type: 'JettonTransfer',
        status: 'ok',
        JettonTransfer: {
          sender: { address: PAYER },
          recipient: { address: WALLET_RAW },
          recipients_wallet: recipientsWallet,
          amount,
          comment,
          jetton: { address: master, symbol: 'USD₮', decimals: 6 },
        },
      },
    ],
  });
  const cfg = { payTo: WALLET, usdtMasters: [USDT], usdtWallets: [OUR_JW], graceMs: 1_800_000 };
  const usdtInv = inv({ id: 'inv-u', comment: 'QR-USDT2345', currency: 'USDT', amount: 3_990_000n });

  it('settles an exact TON payment with the right comment', () => {
    const m = matchPayments([tonEvent()], [inv()], new Set(), cfg);
    expect(m).toEqual([
      { invoiceId: 'inv-1', eventId: 'ev-1', amount: 1_247_000_000n, currency: 'TON', sender: PAYER, paidAt: (Math.floor((t0 + 60_000) / 1000)) * 1000, lt: '100' },
    ]);
  });

  it('accepts overpayment and a comment with different case/spaces', () => {
    expect(matchPayments([tonEvent({}, { amount: 2_000_000_000, comment: '  qr-abcd2345 ' })], [inv()], new Set(), cfg)).toHaveLength(1);
  });

  it('rejects underpayment, wrong comment, missing comment', () => {
    expect(matchPayments([tonEvent({}, { amount: 1_246_999_999 })], [inv()], new Set(), cfg)).toEqual([]);
    expect(matchPayments([tonEvent({}, { comment: 'QR-OTHER999' })], [inv()], new Set(), cfg)).toEqual([]);
    expect(matchPayments([tonEvent({}, { comment: undefined })], [inv()], new Set(), cfg)).toEqual([]);
  });

  it('ignores unfinished, failed, already-seen events and other recipients', () => {
    expect(matchPayments([tonEvent({ in_progress: true })], [inv()], new Set(), cfg)).toEqual([]);
    const failed = tonEvent();
    failed.actions[0]!.status = 'failed';
    expect(matchPayments([failed], [inv()], new Set(), cfg)).toEqual([]);
    expect(matchPayments([tonEvent()], [inv()], new Set(['ev-1']), cfg)).toEqual([]);
    expect(matchPayments([tonEvent({}, { recipient: { address: PAYER } })], [inv()], new Set(), cfg)).toEqual([]);
  });

  it('does not pay a USDT invoice with TON or vice versa', () => {
    expect(matchPayments([tonEvent({}, { comment: 'QR-USDT2345', amount: 99_000_000_000 })], [usdtInv], new Set(), cfg)).toEqual([]);
  });

  it('settles genuine USDT and rejects a fake jetton named USDT', () => {
    expect(matchPayments([usdtEvent(toRaw(USDT).toUpperCase())], [usdtInv], new Set(), cfg)).toHaveLength(1);
    expect(matchPayments([usdtEvent(FAKE_MASTER)], [usdtInv], new Set(), cfg)).toEqual([]);
    expect(matchPayments([usdtEvent(toRaw(USDT), '3989999')], [usdtInv], new Set(), cfg)).toEqual([]);
  });

  it('rejects a token that claims the real USDT master but did not arrive through our USDT wallet', () => {
    expect(matchPayments([usdtEvent(toRaw(USDT), '3990000', 'QR-USDT2345', FAKE_JW)], [usdtInv], new Set(), cfg)).toEqual([]);
    const noWallet = usdtEvent(toRaw(USDT));
    delete noWallet.actions[0]!.JettonTransfer!.recipients_wallet;
    expect(matchPayments([noWallet], [usdtInv], new Set(), cfg)).toEqual([]);
  });

  it('accepts no USDT at all while our USDT wallet is unknown (fail closed)', () => {
    expect(matchPayments([usdtEvent(toRaw(USDT))], [usdtInv], new Set(), { ...cfg, usdtWallets: [] })).toEqual([]);
  });

  it('pays an invoice only once even if two transfers carry its comment', () => {
    const second = tonEvent({ event_id: 'ev-2', lt: 150 });
    const m = matchPayments([second, tonEvent()], [inv()], new Set(), cfg);
    expect(m).toHaveLength(1);
    expect(m[0]!.eventId).toBe('ev-1'); // oldest wins
  });

  it('respects the invoice time window (with grace)', () => {
    const late = tonEvent({ timestamp: Math.floor((t0 + 3_600_000 + 1_800_000 + 1000) / 1000) });
    expect(matchPayments([late], [inv()], new Set(), cfg)).toEqual([]);
    const withinGrace = tonEvent({ timestamp: Math.floor((t0 + 3_600_000 + 60_000) / 1000) });
    expect(matchPayments([withinGrace], [inv()], new Set(), cfg)).toHaveLength(1);
    const before = tonEvent({ timestamp: Math.floor((t0 - 3_600_000) / 1000) });
    expect(matchPayments([before], [inv()], new Set(), cfg)).toEqual([]);
  });
});
