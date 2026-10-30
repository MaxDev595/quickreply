import type { TonApiEvent } from './match';

/** Minimal TonAPI v2 client (https://tonapi.io/api-v2). The key is sent as a Bearer token. */
export class TonApi {
  private readonly fetchFn: typeof fetch;

  constructor(
    private readonly base: string,
    private readonly key: string | undefined,
    fetchFn?: typeof fetch,
  ) {
    // Workers throw "Illegal invocation" if the global fetch is called with another `this`.
    this.fetchFn = fetchFn ?? ((input, init) => fetch(input, init));
  }

  private async get<T>(path: string): Promise<T> {
    const res = await this.fetchFn(`${this.base}${path}`, {
      headers: this.key ? { Authorization: `Bearer ${this.key}`, Accept: 'application/json' } : { Accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`TonAPI ${res.status} for ${path.split('?')[0]}`);
    return (await res.json()) as T;
  }

  /** Newest events first. `startDate` is in seconds. */
  async accountEvents(account: string, opts: { limit?: number; startDate?: number } = {}): Promise<TonApiEvent[]> {
    const q = new URLSearchParams({ limit: String(opts.limit ?? 50) });
    if (opts.startDate) q.set('start_date', String(opts.startDate));
    const data = await this.get<{ events: TonApiEvent[] }>(`/v2/accounts/${encodeURIComponent(account)}/events?${q}`);
    return data.events ?? [];
  }

  /** TON price in USD, or null if unavailable. */
  async tonUsd(): Promise<number | null> {
    const data = await this.get<{ rates?: Record<string, { prices?: Record<string, number> }> }>('/v2/rates?tokens=ton&currencies=usd');
    const v = data.rates?.TON?.prices?.USD ?? data.rates?.ton?.prices?.USD;
    return typeof v === 'number' && v > 0 ? v : null;
  }
}
