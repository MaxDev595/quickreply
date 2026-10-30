// Mock TonAPI for integration tests. Serves /v2/rates and /v2/accounts/:id/events,
// and lets the test inject "on-chain" events via POST /__events.
import { createServer } from 'node:http';

/** The receiving wallet's USDT jetton wallet in the mock chain. */
export const OUR_USDT_WALLET = '0:' + 'c'.repeat(64);

export function startMockTonApi(port) {
  const events = [];
  const requests = [];
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    requests.push({ path: url.pathname, auth: req.headers.authorization ?? null });
    const send = (code, body) => {
      res.writeHead(code, { 'content-type': 'application/json' });
      res.end(JSON.stringify(body));
    };
    if (req.method === 'POST' && url.pathname === '/__events') {
      let data = '';
      for await (const chunk of req) data += chunk;
      events.unshift(JSON.parse(data)); // newest first, like TonAPI
      return send(200, { ok: true });
    }
    // get_wallet_address(owner) on the USDT master → our jetton wallet
    if (/^\/v2\/blockchain\/accounts\/[^/]+\/methods\/get_wallet_address$/.test(url.pathname)) {
      return send(200, { success: true, exit_code: 0, decoded: { jetton_wallet_address: OUR_USDT_WALLET } });
    }
    if (url.pathname === '/v2/rates') return send(200, { rates: { TON: { prices: { USD: 3.2 } } } });
    if (/^\/v2\/accounts\/[^/]+\/events$/.test(url.pathname)) {
      const since = Number(url.searchParams.get('start_date') ?? 0);
      return send(200, { events: events.filter((e) => e.timestamp >= since), next_from: 0 });
    }
    send(404, { error: 'not found' });
  });
  return new Promise((ok) =>
    server.listen(port, '127.0.0.1', () =>
      ok({ events, requests, close: () => new Promise((r) => server.close(r)) }),
    ),
  );
}
