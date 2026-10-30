/**
 * Billing service: invoices, chain scanning, licenses. All entitlement
 * decisions happen here, on the server.
 */
import {
  MAX_SEATS,
  PLANS,
  isPaidPlan,
  type Entitlement,
  type InvoiceStatus,
  type InvoiceView,
  type PaidPlanId,
  type PayCurrency,
  type Tier,
} from '@quickreply/shared';
import { toFriendly, toRaw } from './address';
import { matchPayments, type OpenInvoice, type PaymentMatch } from './match';
import { formatUnits, quote } from './pricing';
import { TonApi } from './tonapi';

export interface Env {
  DB: D1Database;
  /** Receiving wallet (any address form). */
  PAY_TO: string;
  /** "testnet" or "mainnet". */
  TON_NETWORK: string;
  /** Comma-separated USDT jetton master addresses (allowlist). */
  USDT_MASTERS: string;
  /** Comma-separated allowed origins; "chrome-extension://*" allows any extension. */
  ALLOWED_ORIGINS: string;
  /** Test mode only: divide prices (testnet faucets give little TON). */
  TEST_PRICE_DIVISOR?: string;
  /** Override TonAPI base URL (tests). */
  TONAPI_BASE?: string;
  /** Secret: TonAPI / TON Console key. */
  TONAPI_KEY?: string;
}

const INVOICE_TTL_MS = 60 * 60 * 1000;
const GRACE_MS = 30 * 60 * 1000;
const SCAN_MIN_INTERVAL_MS = 8_000;
const MAX_PENDING_PER_INSTALL = 10;
const DAY = 86_400_000;
const TIER_RANK: Record<Tier, number> = { free: 0, pro: 1, business: 2 };

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I
function randomCode(len: number): string {
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  return [...bytes].map((b) => ALPHABET[b % ALPHABET.length]).join('');
}

export const newLicenseKey = () => `QR-${randomCode(4)}-${randomCode(4)}-${randomCode(4)}-${randomCode(4)}`;
export const INSTALL_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export const LICENSE_RE = /^QR(-[A-Z2-9]{4}){4}$/;

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

interface InvoiceRow {
  id: string;
  install_id: string;
  plan: string;
  seats: number;
  currency: PayCurrency;
  amount: string;
  usd_cents: number;
  comment: string;
  pay_to: string;
  status: InvoiceStatus;
  created_at: number;
  expires_at: number;
  paid_at: number | null;
  license_key: string | null;
}

interface LicenseRow {
  license_key: string;
  tier: 'pro' | 'business';
  plan: string;
  seats: number;
  expires_at: number;
}

export class Billing {
  readonly testMode: boolean;
  readonly payTo: string;
  private readonly api: TonApi;

  constructor(
    private readonly env: Env,
    private readonly now: () => number = Date.now,
    fetchFn?: typeof fetch,
  ) {
    this.testMode = env.TON_NETWORK !== 'mainnet';
    this.payTo = toRaw(env.PAY_TO);
    const base = env.TONAPI_BASE ?? (this.testMode ? 'https://testnet.tonapi.io' : 'https://tonapi.io');
    this.api = new TonApi(base, env.TONAPI_KEY, fetchFn);
  }

  private get usdtMasters(): string[] {
    return this.env.USDT_MASTERS.split(',').map((s) => s.trim()).filter(Boolean);
  }

  currencies(): PayCurrency[] {
    return this.usdtMasters.length > 0 ? ['USDT', 'TON'] : ['TON'];
  }

  private divisor(): number {
    const d = Number(this.env.TEST_PRICE_DIVISOR ?? '1');
    return this.testMode && Number.isFinite(d) && d >= 1 ? d : 1;
  }

  private view(row: InvoiceRow): InvoiceView {
    const friendly = toFriendly(row.pay_to, { bounceable: false, testnet: this.testMode });
    const params = new URLSearchParams({ amount: row.amount, text: row.comment });
    if (row.currency === 'USDT') params.set('jetton', toFriendly(this.usdtMasters[0]!, { bounceable: true, testnet: this.testMode }));
    params.set('exp', String(Math.floor(row.expires_at / 1000)));
    return {
      id: row.id,
      plan: row.plan as PaidPlanId,
      seats: row.seats,
      currency: row.currency,
      amount: row.amount,
      amountDisplay: formatUnits(BigInt(row.amount), row.currency),
      usdCents: row.usd_cents,
      payTo: friendly,
      comment: row.comment,
      link: `ton://transfer/${friendly}?${params}`,
      status: row.status,
      expiresAt: row.expires_at,
      testMode: this.testMode,
      licenseKey: row.status === 'paid' ? row.license_key : null,
    };
  }

  async createInvoice(input: { installId?: unknown; plan?: unknown; seats?: unknown; currency?: unknown }): Promise<InvoiceView> {
    const { installId, plan } = input;
    if (typeof installId !== 'string' || !INSTALL_ID_RE.test(installId)) throw new HttpError(400, 'Invalid installId');
    if (!isPaidPlan(plan)) throw new HttpError(400, 'Unknown plan');
    const seats = PLANS[plan].perSeat ? Number(input.seats ?? 1) : 1;
    if (!Number.isInteger(seats) || seats < 1 || seats > MAX_SEATS) throw new HttpError(400, `Seats must be 1–${MAX_SEATS}`);
    const currency = input.currency;
    if (currency !== 'USDT' && currency !== 'TON') throw new HttpError(400, 'Unknown currency');
    if (!this.currencies().includes(currency)) throw new HttpError(400, `${currency} is not accepted in this mode`);

    const pending = await this.env.DB.prepare(
      "SELECT COUNT(*) AS n FROM invoices WHERE install_id = ? AND status = 'pending' AND expires_at > ?",
    )
      .bind(installId, this.now())
      .first<{ n: number }>();
    if ((pending?.n ?? 0) >= MAX_PENDING_PER_INSTALL) throw new HttpError(429, 'Too many open invoices. Pay or wait for one to expire.');

    const tonUsd = currency === 'TON' ? await this.api.tonUsd().catch((e: Error) => (console.error('TON rate fetch failed:', e.message), null)) : null;
    let q;
    try {
      q = quote(plan, seats, currency, tonUsd, this.divisor());
    } catch (e) {
      throw new HttpError(503, (e as Error).message);
    }
    const now = this.now();
    const row: InvoiceRow = {
      id: crypto.randomUUID(),
      install_id: installId,
      plan,
      seats,
      currency,
      amount: q.amount.toString(),
      usd_cents: q.usdCents,
      comment: `QR-${randomCode(8)}`,
      pay_to: this.payTo,
      status: 'pending',
      created_at: now,
      expires_at: now + INVOICE_TTL_MS,
      paid_at: null,
      license_key: null,
    };
    await this.env.DB.prepare(
      `INSERT INTO invoices (id, install_id, plan, seats, currency, amount, usd_cents, comment, pay_to, status, created_at, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(row.id, row.install_id, row.plan, row.seats, row.currency, row.amount, row.usd_cents, row.comment, row.pay_to, row.status, row.created_at, row.expires_at)
      .run();
    return this.view(row);
  }

  async getInvoice(id: string, installId: unknown): Promise<InvoiceView> {
    const row = await this.env.DB.prepare('SELECT * FROM invoices WHERE id = ?').bind(id).first<InvoiceRow>();
    // Invoices are only visible to the install that created them (the license key is in the paid view).
    if (!row || row.install_id !== installId) throw new HttpError(404, 'Invoice not found');
    if (row.status === 'pending') {
      await this.scanIfDue().catch(() => undefined);
      const fresh = await this.env.DB.prepare('SELECT * FROM invoices WHERE id = ?').bind(id).first<InvoiceRow>();
      if (fresh) return this.view(await this.expireIfNeeded(fresh));
    }
    return this.view(await this.expireIfNeeded(row));
  }

  private async expireIfNeeded(row: InvoiceRow): Promise<InvoiceRow> {
    if (row.status === 'pending' && this.now() > row.expires_at + GRACE_MS) {
      await this.env.DB.prepare("UPDATE invoices SET status = 'expired' WHERE id = ? AND status = 'pending'").bind(row.id).run();
      return { ...row, status: 'expired' };
    }
    return row;
  }

  /** Throttled scan, used when a client polls an invoice. */
  async scanIfDue(): Promise<number> {
    const last = await this.env.DB.prepare("SELECT v FROM state WHERE k = 'last_scan'").first<{ v: string }>();
    if (last && this.now() - Number(last.v) < SCAN_MIN_INTERVAL_MS) return 0;
    return this.scan();
  }

  /** Reads recent events of the receiving wallet and settles matching invoices. */
  async scan(): Promise<number> {
    const now = this.now();
    await this.env.DB.prepare("INSERT INTO state (k, v) VALUES ('last_scan', ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v")
      .bind(String(now))
      .run();
    const open = await this.env.DB.prepare("SELECT * FROM invoices WHERE status = 'pending' AND expires_at > ?")
      .bind(now - GRACE_MS)
      .all<InvoiceRow>();
    const invoices: OpenInvoice[] = open.results.map((r) => ({
      id: r.id,
      comment: r.comment,
      currency: r.currency,
      amount: BigInt(r.amount),
      createdAt: r.created_at,
      expiresAt: r.expires_at,
    }));
    if (invoices.length === 0) return 0;
    const since = Math.floor((Math.min(...invoices.map((i) => i.createdAt)) - 120_000) / 1000);
    const events = await this.api.accountEvents(this.payTo, { limit: 100, startDate: since });
    const seen = await this.env.DB.prepare(
      `SELECT event_id FROM payments WHERE event_id IN (${events.map(() => '?').join(',') || "''"})`,
    )
      .bind(...events.map((e) => e.event_id))
      .all<{ event_id: string }>();
    const matches = matchPayments(events, invoices, new Set(seen.results.map((r) => r.event_id)), {
      payTo: this.payTo,
      usdtMasters: this.usdtMasters,
      graceMs: GRACE_MS,
    });
    let settled = 0;
    for (const m of matches) if (await this.settle(m)) settled++;
    return settled;
  }

  /** Marks an invoice paid and issues or extends the license. Idempotent. */
  private async settle(m: PaymentMatch): Promise<boolean> {
    const inv = await this.env.DB.prepare("SELECT * FROM invoices WHERE id = ? AND status = 'pending'").bind(m.invoiceId).first<InvoiceRow>();
    if (!inv) return false;
    const plan = PLANS[inv.plan as PaidPlanId];
    const now = this.now();

    // Renew the install's current license of the same tier, otherwise issue a new one.
    const current = await this.env.DB.prepare(
      `SELECT l.* FROM licenses l JOIN activations a ON a.license_key = l.license_key
       WHERE a.install_id = ? AND l.tier = ? ORDER BY l.expires_at DESC LIMIT 1`,
    )
      .bind(inv.install_id, plan.tier)
      .first<LicenseRow>();
    const key = current?.license_key ?? newLicenseKey();
    const base = current && current.expires_at > now ? current.expires_at : now;
    const expires = base + plan.periodDays * DAY;

    const stmts = [
      this.env.DB.prepare('INSERT INTO payments (event_id, invoice_id, currency, amount, sender, lt, paid_at) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(
        m.eventId,
        inv.id,
        m.currency,
        m.amount.toString(),
        m.sender,
        m.lt,
        m.paidAt,
      ),
      this.env.DB.prepare(
        "UPDATE invoices SET status = 'paid', paid_at = ?, event_id = ?, sender = ?, license_key = ? WHERE id = ? AND status = 'pending'",
      ).bind(m.paidAt, m.eventId, m.sender, key, inv.id),
      current
        ? this.env.DB.prepare('UPDATE licenses SET expires_at = ?, seats = ?, plan = ?, updated_at = ? WHERE license_key = ?').bind(
            expires,
            inv.seats,
            inv.plan,
            now,
            key,
          )
        : this.env.DB.prepare(
            'INSERT INTO licenses (license_key, tier, plan, seats, expires_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
          ).bind(key, plan.tier, inv.plan, inv.seats, expires, now, now),
      this.env.DB.prepare('INSERT OR IGNORE INTO activations (license_key, install_id, activated_at) VALUES (?, ?, ?)').bind(key, inv.install_id, now),
    ];
    try {
      await this.env.DB.batch(stmts);
      return true;
    } catch {
      return false; // e.g. event already recorded by a concurrent scan
    }
  }

  async entitlement(installId: unknown): Promise<Entitlement> {
    if (typeof installId !== 'string' || !INSTALL_ID_RE.test(installId)) throw new HttpError(400, 'Invalid installId');
    const rows = await this.env.DB.prepare(
      `SELECT l.* FROM licenses l JOIN activations a ON a.license_key = l.license_key
       WHERE a.install_id = ? AND l.expires_at > ?`,
    )
      .bind(installId, this.now())
      .all<LicenseRow>();
    const best = rows.results.sort((a, b) => TIER_RANK[b.tier] - TIER_RANK[a.tier] || b.expires_at - a.expires_at)[0];
    if (!best) return { tier: 'free', plan: 'free', seats: 1, expiresAt: null, licenseKey: null, testMode: this.testMode };
    return {
      tier: best.tier,
      plan: best.plan as PaidPlanId,
      seats: best.seats,
      expiresAt: best.expires_at,
      licenseKey: best.license_key,
      testMode: this.testMode,
    };
  }

  /** Uses a license on another browser/device (or a team member's, for Business). */
  async activate(input: { installId?: unknown; licenseKey?: unknown }): Promise<Entitlement> {
    const { installId } = input;
    const key = typeof input.licenseKey === 'string' ? input.licenseKey.trim().toUpperCase() : '';
    if (typeof installId !== 'string' || !INSTALL_ID_RE.test(installId)) throw new HttpError(400, 'Invalid installId');
    if (!LICENSE_RE.test(key)) throw new HttpError(400, 'This does not look like a QuickReply license key.');
    const lic = await this.env.DB.prepare('SELECT * FROM licenses WHERE license_key = ?').bind(key).first<LicenseRow>();
    if (!lic) throw new HttpError(404, 'License key not found.');
    if (lic.expires_at <= this.now()) throw new HttpError(410, 'This license has expired.');
    const plan = PLANS[lic.plan as PaidPlanId];
    const limit = plan.devices * (plan.perSeat ? lic.seats : 1);
    const already = await this.env.DB.prepare('SELECT 1 AS x FROM activations WHERE license_key = ? AND install_id = ?').bind(key, installId).first();
    if (!already) {
      const used = await this.env.DB.prepare('SELECT COUNT(*) AS n FROM activations WHERE license_key = ?').bind(key).first<{ n: number }>();
      if ((used?.n ?? 0) >= limit) throw new HttpError(409, `This license is already used on ${limit} ${limit === 1 ? 'device' : 'devices'}.`);
      await this.env.DB.prepare('INSERT INTO activations (license_key, install_id, activated_at) VALUES (?, ?, ?)').bind(key, installId, this.now()).run();
    }
    return this.entitlement(installId);
  }

  async deactivate(input: { installId?: unknown; licenseKey?: unknown }): Promise<Entitlement> {
    const { installId } = input;
    if (typeof installId !== 'string' || !INSTALL_ID_RE.test(installId)) throw new HttpError(400, 'Invalid installId');
    const key = typeof input.licenseKey === 'string' ? input.licenseKey.trim().toUpperCase() : '';
    await this.env.DB.prepare('DELETE FROM activations WHERE license_key = ? AND install_id = ?').bind(key, installId).run();
    return this.entitlement(installId);
  }

  async publicConfig() {
    return {
      testMode: this.testMode,
      network: this.testMode ? 'testnet' : 'mainnet',
      currencies: this.currencies(),
      priceDivisor: this.divisor(),
      payTo: toFriendly(this.payTo, { bounceable: false, testnet: this.testMode }),
    };
  }
}
