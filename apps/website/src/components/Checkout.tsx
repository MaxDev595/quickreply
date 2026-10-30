'use client';

import {
  MAX_SEATS,
  PAID_PLANS,
  PLANS,
  formatUsd,
  totalCents,
  type InvoiceView,
  type PaidPlanId,
  type PayCurrency,
} from '@quickreply/shared';
import { Check, Copy, ExternalLink, Loader2, Minus, Plus, ShieldCheck } from 'lucide-react';
import QRCode from 'qrcode';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { siteConfig } from '@/site.config';

interface Config {
  testMode: boolean;
  network: 'testnet' | 'mainnet';
  currencies: PayCurrency[];
  priceDivisor: number;
  payTo: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const LOCAL_KEY = 'qr.checkoutInstall';

/** The extension passes its install id (?install=…). Opened directly, the page keeps its own. */
function resolveInstall(): { id: string; fromExtension: boolean } {
  const fromUrl = new URLSearchParams(location.search).get('install');
  if (fromUrl && UUID_RE.test(fromUrl)) return { id: fromUrl, fromExtension: true };
  try {
    const saved = localStorage.getItem(LOCAL_KEY);
    if (saved && UUID_RE.test(saved)) return { id: saved, fromExtension: false };
    const fresh = crypto.randomUUID();
    localStorage.setItem(LOCAL_KEY, fresh);
    return { id: fresh, fromExtension: false };
  } catch {
    return { id: crypto.randomUUID(), fromExtension: false };
  }
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${siteConfig.billingApi}${path}`, { ...init, headers: { 'Content-Type': 'application/json' } });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error ?? `Request failed (${res.status})`);
  return data;
}

function CopyField({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  const [copied, setCopied] = useState(false);
  return (
    <div>
      <div className="text-[12px] text-muted">{label}</div>
      <div className="mt-1 flex items-center gap-2">
        <code className={`min-w-0 flex-1 truncate rounded-lg border border-line bg-bg-alt px-3 py-2 font-mono text-[13px] ${strong ? 'font-semibold text-fg' : ''}`}>
          {value}
        </code>
        <button
          type="button"
          aria-label={`Copy ${label}`}
          onClick={async () => {
            await navigator.clipboard.writeText(value).catch(() => undefined);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg border border-line hover:bg-bg-alt"
        >
          {copied ? <Check size={15} className="text-accent" /> : <Copy size={15} />}
        </button>
      </div>
    </div>
  );
}

export function Checkout() {
  const [install, setInstall] = useState<{ id: string; fromExtension: boolean } | null>(null);
  const installId = install?.id ?? null;
  const fromExtension = install?.fromExtension ?? false;
  const [config, setConfig] = useState<Config | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);
  const [plan, setPlan] = useState<PaidPlanId>('pro_annual');
  const [seats, setSeats] = useState(5);
  const [currency, setCurrency] = useState<PayCurrency>('USDT');
  const [invoice, setInvoice] = useState<InvoiceView | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [qr, setQr] = useState<{ link: string; src: string } | null>(null);

  useEffect(() => {
    api<Config>('/v1/config')
      .then((c) => {
        setConfig(c);
        if (!c.currencies.includes('USDT')) setCurrency('TON');
      })
      .catch((e: Error) => setConfigError(e.message));
  }, []);

  const p = PLANS[plan];
  const effectiveSeats = p.perSeat ? seats : 1;
  const cents = totalCents(plan, effectiveSeats);

  const create = useCallback(async () => {
    const who = install ?? resolveInstall();
    setInstall(who);
    setBusy(true);
    setError(null);
    try {
      const inv = await api<InvoiceView>('/v1/invoices', {
        method: 'POST',
        body: JSON.stringify({ installId: who.id, plan, seats: effectiveSeats, currency }),
      });
      setInvoice(inv);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [install, plan, effectiveSeats, currency]);

  // Poll the invoice until it is paid or expired.
  useEffect(() => {
    if (!invoice || invoice.status !== 'pending' || !installId) return;
    const t = setInterval(async () => {
      try {
        const next = await api<InvoiceView>(`/v1/invoices/${invoice.id}?installId=${installId}`);
        setInvoice(next);
      } catch {
        /* keep polling */
      }
    }, 5000);
    return () => clearInterval(t);
  }, [invoice, installId]);

  const link = invoice?.link ?? null;
  useEffect(() => {
    if (!link) return;
    let alive = true;
    QRCode.toString(link, { type: 'svg', margin: 1, width: 220, color: { dark: '#111827', light: '#ffffff' } })
      .then((svg) => alive && setQr({ link, src: `data:image/svg+xml;utf8,${encodeURIComponent(svg)}` }))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [link]);
  const qrSrc = qr && qr.link === link ? qr.src : null;

  const tonkeeperLink = useMemo(() => {
    if (!invoice) return '';
    return invoice.link.replace(/^ton:\/\/transfer\//, 'https://app.tonkeeper.com/transfer/');
  }, [invoice]);

  if (!siteConfig.billingApi) return null;

  return (
    <section id="checkout" aria-label="Checkout" className="mx-auto max-w-[1120px] px-5 pb-24 sm:px-8">
      {config?.testMode && (
        <div role="note" className="mb-6 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-[14px] text-amber-900">
          <strong>Test mode.</strong> Payments go through TON <strong>testnet</strong>: use a testnet wallet and free test coins. No real money
          is charged{config.priceDivisor > 1 ? `, and prices are divided by ${config.priceDivisor}` : ''}. Paid features are still in
          development.
        </div>
      )}
      {configError && (
        <p role="alert" className="mb-6 text-[14px] text-danger">
          Billing is unavailable right now ({configError}).
        </p>
      )}

      <div className="grid gap-8 lg:grid-cols-[1fr_420px]">
        <div>
          <h2 className="text-[24px] font-semibold tracking-[-0.02em]">Choose a plan</h2>
          <div role="radiogroup" aria-label="Plan" className="mt-5 grid gap-3 sm:grid-cols-3">
            {PAID_PLANS.map((id) => {
              const info = PLANS[id];
              const selected = plan === id;
              return (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  disabled={!!invoice && invoice.status === 'pending'}
                  onClick={() => setPlan(id)}
                  className={`relative rounded-xl border p-4 text-left transition-colors disabled:opacity-60 ${selected ? 'border-accent bg-accent-soft' : 'border-line hover:border-line-strong'}`}
                >
                  {info.recommended && (
                    <span className="absolute -top-2.5 right-3 rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold text-white">Best value</span>
                  )}
                  <div className="text-[15px] font-semibold">{info.name}</div>
                  <div className="mt-1 text-[22px] font-semibold tracking-[-0.02em]">
                    {formatUsd(info.priceCents)}
                    <span className="text-[13px] font-normal text-muted">
                      {info.perSeat ? ' /user/mo' : info.periodDays >= 365 ? ' /year' : ' /month'}
                    </span>
                  </div>
                  <ul className="mt-3 flex flex-col gap-1 text-[13px] text-muted">
                    {info.features.map((f) => (
                      <li key={f} className="flex gap-1.5">
                        <Check size={14} className="mt-0.5 shrink-0 text-accent" />
                        {f}
                      </li>
                    ))}
                  </ul>
                </button>
              );
            })}
          </div>

          {p.perSeat && (
            <div className="mt-5 flex items-center gap-3">
              <span className="text-[14px] font-medium">Team size</span>
              <div className="inline-flex items-center rounded-lg border border-line">
                <button type="button" aria-label="Fewer seats" className="size-9" onClick={() => setSeats((s) => Math.max(1, s - 1))} disabled={!!invoice}>
                  <Minus size={15} className="mx-auto" />
                </button>
                <input
                  aria-label="Seats"
                  inputMode="numeric"
                  value={seats}
                  disabled={!!invoice}
                  onChange={(e) => setSeats(Math.min(MAX_SEATS, Math.max(1, Number(e.target.value.replace(/\D/g, '')) || 1)))}
                  className="w-14 border-x border-line py-1.5 text-center text-[14px] outline-none"
                />
                <button type="button" aria-label="More seats" className="size-9" onClick={() => setSeats((s) => Math.min(MAX_SEATS, s + 1))} disabled={!!invoice}>
                  <Plus size={15} className="mx-auto" />
                </button>
              </div>
              <span className="text-[13px] text-muted">One license key, usable by {seats} {seats === 1 ? 'person' : 'people'}.</span>
            </div>
          )}

          <p className="mt-6 flex items-start gap-2 text-[13px] leading-relaxed text-muted">
            <ShieldCheck size={16} className="mt-0.5 shrink-0 text-accent" />
            Crypto payments don’t renew automatically. You pay for one period in advance; buying again extends your current plan.
          </p>
        </div>

        <aside className="rounded-2xl border border-line p-5 shadow-[0_24px_48px_-32px_rgb(17_24_39/0.3)]">
          {!invoice ? (
            <>
              <div className="flex items-baseline justify-between">
                <span className="text-[15px] font-semibold">{p.name}</span>
                <span className="text-[22px] font-semibold">{formatUsd(cents)}</span>
              </div>
              {p.perSeat && <div className="mt-1 text-right text-[13px] text-muted">{effectiveSeats} × {formatUsd(p.priceCents)}</div>}
              <div className="mt-5 text-[13px] font-medium">Pay with</div>
              <div role="radiogroup" aria-label="Currency" className="mt-2 grid grid-cols-2 gap-2">
                {(['USDT', 'TON'] as const).map((c) => {
                  const available = config?.currencies.includes(c) ?? false;
                  return (
                    <button
                      key={c}
                      type="button"
                      role="radio"
                      aria-checked={currency === c}
                      disabled={!available}
                      onClick={() => setCurrency(c)}
                      className={`rounded-lg border px-3 py-2.5 text-left text-[14px] disabled:opacity-40 ${currency === c ? 'border-accent bg-accent-soft font-semibold' : 'border-line'}`}
                    >
                      {c === 'USDT' ? 'USDT (TON)' : 'Toncoin'}
                      {!available && <span className="block text-[11px] font-normal text-muted">Not in test mode</span>}
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                onClick={create}
                disabled={busy || !config}
                className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-accent text-[15px] font-semibold text-white hover:bg-accent-hover disabled:opacity-50"
              >
                {busy && <Loader2 size={16} className="animate-spin" />}
                Continue to payment
              </button>
              {error && (
                <p role="alert" className="mt-3 text-[13px] text-danger">
                  {error}
                </p>
              )}
            </>
          ) : invoice.status === 'paid' ? (
            <div aria-live="polite">
              <div className="flex size-10 items-center justify-center rounded-full bg-accent-soft">
                <Check size={20} className="text-accent" />
              </div>
              <h3 className="mt-3 text-[18px] font-semibold">Payment received</h3>
              <p className="mt-1 text-[14px] leading-relaxed text-muted">
                {PLANS[invoice.plan].name} is active
                {fromExtension ? ' in your QuickReply extension. You can close this tab.' : '. Paste this license key in QuickReply → Settings → Plan.'}
              </p>
              {invoice.licenseKey && (
                <div className="mt-4">
                  <CopyField label="License key" value={invoice.licenseKey} strong />
                  <p className="mt-2 text-[12px] text-muted">
                    Keep it: use it to activate other devices{invoice.seats > 1 ? ' and your team members (one per seat)' : ''}.
                  </p>
                </div>
              )}
            </div>
          ) : invoice.status === 'expired' ? (
            <div>
              <h3 className="text-[18px] font-semibold">Invoice expired</h3>
              <p className="mt-1 text-[14px] text-muted">No payment arrived in time. If you already sent it, contact support with the payment reference.</p>
              <button type="button" onClick={() => setInvoice(null)} className="mt-4 h-10 rounded-lg border border-line px-4 text-[14px] font-medium">
                Start over
              </button>
            </div>
          ) : (
            <div>
              <div className="flex items-baseline justify-between">
                <span className="text-[14px] text-muted">Send exactly</span>
                <span className="text-[22px] font-semibold tabular-nums">
                  {invoice.amountDisplay} {invoice.currency === 'USDT' ? 'USDT' : 'TON'}
                </span>
              </div>
              {qrSrc && (
                <img src={qrSrc} alt="Payment QR code: scan with your TON wallet" width={220} height={220} className="mx-auto mt-4 rounded-lg border border-line" />
              )}
              <div className="mt-4 flex gap-2">
                <a href={invoice.link} className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-lg bg-graphite text-[14px] font-medium text-white">
                  Open in wallet
                </a>
                <a href={tonkeeperLink} target="_blank" rel="noopener" className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-lg border border-line text-[14px] font-medium">
                  Tonkeeper <ExternalLink size={14} />
                </a>
              </div>
              <div className="mt-5 flex flex-col gap-3">
                <CopyField label={`Address${invoice.testMode ? ' (testnet)' : ''}`} value={invoice.payTo} />
                <CopyField label="Comment (required)" value={invoice.comment} strong />
              </div>
              <p className="mt-3 rounded-lg bg-bg-alt px-3 py-2 text-[12px] leading-relaxed text-muted">
                Include the comment exactly: it is how we match your payment. The wallet links above fill it in for you.
              </p>
              <div aria-live="polite" className="mt-4 flex items-center gap-2 text-[13px] text-muted">
                <Loader2 size={14} className="animate-spin" /> Waiting for payment… This page updates by itself.
              </div>
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}
