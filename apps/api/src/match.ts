/**
 * Pure payment matching: given TonAPI account events for the receiving wallet,
 * find transfers that pay an invoice. No I/O here, so it is fully unit-tested.
 *
 * Rules:
 * - Only finished events (in_progress = false) and successful actions (status "ok").
 * - The recipient must be our wallet (compared in raw form).
 * - The comment must equal the invoice comment exactly (case-insensitive, trimmed).
 * - TON: TonTransfer with amount >= invoice amount.
 * - USDT: JettonTransfer whose jetton master is on the allowlist (never trust the
 *   name/symbol: anyone can mint a jetton called "USDT") AND whose receiving jetton
 *   wallet is our own USDT wallet, derived on-chain from the real USDT master
 *   (get_wallet_address). A fake token can claim any master in its metadata, but it
 *   can't make a transfer arrive through our genuine USDT wallet. amount >= invoice amount.
 * - Each event can pay at most one invoice; event ids are recorded so a payment
 *   is never counted twice.
 */
import { sameAddress } from './address';

export interface TonApiAccountAddress {
  address: string;
  is_scam?: boolean;
}

export interface TonApiAction {
  type: string;
  status: 'ok' | 'failed' | string;
  TonTransfer?: { sender: TonApiAccountAddress; recipient: TonApiAccountAddress; amount: number | string; comment?: string };
  JettonTransfer?: {
    sender?: TonApiAccountAddress;
    recipient?: TonApiAccountAddress;
    /** Jetton wallet that received the tokens (ours, if genuine). */
    recipients_wallet?: string;
    senders_wallet?: string;
    amount: string;
    comment?: string;
    jetton: { address: string; symbol?: string; decimals?: number };
  };
}

export interface TonApiEvent {
  event_id: string;
  timestamp: number;
  lt: number | string;
  in_progress: boolean;
  is_scam?: boolean;
  actions: TonApiAction[];
}

export interface OpenInvoice {
  id: string;
  comment: string;
  currency: 'USDT' | 'TON';
  amount: bigint;
  createdAt: number; // epoch ms
  expiresAt: number; // epoch ms
}

export interface PaymentMatch {
  invoiceId: string;
  eventId: string;
  amount: bigint;
  currency: 'USDT' | 'TON';
  sender: string | null;
  paidAt: number; // epoch ms
  lt: string;
}

export interface MatchConfig {
  payTo: string;
  usdtMasters: string[];
  /** Our USDT jetton wallet(s). USDT is accepted only when the transfer arrived there. Empty = no USDT. */
  usdtWallets: string[];
  /** Payments that arrive this long after expiry are still accepted (chain/indexer delay). */
  graceMs: number;
}

const norm = (c: string | undefined) => (c ?? '').trim().toUpperCase();

function toBig(v: number | string): bigint | null {
  try {
    return BigInt(typeof v === 'number' ? Math.trunc(v) : v);
  } catch {
    return null;
  }
}

export function matchPayments(
  events: readonly TonApiEvent[],
  invoices: readonly OpenInvoice[],
  seenEventIds: ReadonlySet<string>,
  cfg: MatchConfig,
): PaymentMatch[] {
  const byComment = new Map(invoices.map((i) => [norm(i.comment), i]));
  const paid = new Set<string>();
  const matches: PaymentMatch[] = [];

  // Oldest first, so the first valid payment wins.
  const ordered = [...events].sort((a, b) => Number(BigInt(a.lt) - BigInt(b.lt)));
  for (const ev of ordered) {
    if (ev.in_progress || seenEventIds.has(ev.event_id)) continue;
    const paidAt = ev.timestamp * 1000;
    for (const action of ev.actions) {
      if (action.status !== 'ok') continue;
      let currency: 'USDT' | 'TON';
      let amount: bigint | null;
      let comment: string | undefined;
      let sender: string | null;
      if (action.type === 'TonTransfer' && action.TonTransfer) {
        const t = action.TonTransfer;
        if (!sameAddress(t.recipient?.address, cfg.payTo)) continue;
        currency = 'TON';
        amount = toBig(t.amount);
        comment = t.comment;
        sender = t.sender?.address ?? null;
      } else if (action.type === 'JettonTransfer' && action.JettonTransfer) {
        const j = action.JettonTransfer;
        if (!sameAddress(j.recipient?.address, cfg.payTo)) continue;
        if (!cfg.usdtMasters.some((m) => sameAddress(m, j.jetton?.address))) continue;
        if (!cfg.usdtWallets.some((w) => sameAddress(w, j.recipients_wallet))) continue;
        currency = 'USDT';
        amount = toBig(j.amount);
        comment = j.comment;
        sender = j.sender?.address ?? null;
      } else {
        continue;
      }
      const invoice = byComment.get(norm(comment));
      if (!invoice || paid.has(invoice.id) || amount === null) continue;
      if (invoice.currency !== currency) continue;
      if (amount < invoice.amount) continue;
      if (paidAt < invoice.createdAt - 60_000 || paidAt > invoice.expiresAt + cfg.graceMs) continue;
      paid.add(invoice.id);
      matches.push({ invoiceId: invoice.id, eventId: ev.event_id, amount, currency, sender, paidAt, lt: String(ev.lt) });
      break; // one invoice per event
    }
  }
  return matches;
}
