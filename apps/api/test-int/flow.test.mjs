/**
 * Integration test: real Worker (wrangler dev, local D1) + mock TonAPI.
 * Run: npm run test:int -w @quickreply/api
 */
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { resolve } from 'node:path';
import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { OUR_USDT_WALLET, startMockTonApi } from './mock-tonapi.mjs';

const ROOT = resolve(import.meta.dirname, '..');
const API = 'http://127.0.0.1:8799';
const MOCK_PORT = 8798;
const WALLET_RAW = '0:c037b6ae8013ccf15b697319797d56bf670df7bd303415fb883a5261e53093eb';
const PAYER = '0:1111111111111111111111111111111111111111111111111111111111111111';
const USDT_RAW = '0:b113a994b5024a16719f69139328eb759596c38a25f59028b146fecdc3621dfe';

let mock;
let worker;

async function waitFor(url, ms = 60_000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try {
      const r = await fetch(url);
      if (r.ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

const api = async (path, init) => {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', origin: 'chrome-extension://abc', ...(init?.headers ?? {}) },
  });
  return { status: res.status, body: await res.json(), headers: res.headers };
};

function chainEvent({ id, amount, comment, type = 'TonTransfer', master = USDT_RAW, jettonWallet = OUR_USDT_WALLET, ts = Math.floor(Date.now() / 1000) }) {
  const action =
    type === 'TonTransfer'
      ? { type, status: 'ok', TonTransfer: { sender: { address: PAYER }, recipient: { address: WALLET_RAW.toUpperCase() }, amount: Number(amount), comment } }
      : { type, status: 'ok', JettonTransfer: { sender: { address: PAYER }, recipient: { address: WALLET_RAW }, recipients_wallet: jettonWallet, amount: String(amount), comment, jetton: { address: master, symbol: 'USD₮', decimals: 6 } } };
  return { event_id: id, timestamp: ts, lt: Date.now(), in_progress: false, actions: [action] };
}

const pushEvent = (ev) => fetch(`http://127.0.0.1:${MOCK_PORT}/__events`, { method: 'POST', body: JSON.stringify(ev) });

before(async () => {
  mock = await startMockTonApi(MOCK_PORT);
  worker = spawn(
    'npx',
    [
      'wrangler', 'dev', '--port', '8799', '--ip', '127.0.0.1', '--persist-to', '.wrangler/int-state',
      '--var', `TONAPI_BASE:http://127.0.0.1:${MOCK_PORT}`,
      '--var', `USDT_MASTERS:${USDT_RAW}`,
      '--var', 'TEST_PRICE_DIVISOR:1',
      '--var', 'TONAPI_KEY:test-key-123',
    ],
    { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'], env: (() => {
        // Local mock only: keep the worker's outbound fetch off the sandbox proxy.
        const e = { ...process.env, WRANGLER_SEND_METRICS: 'false', CI: '1' };
        for (const k of ['HTTPS_PROXY', 'HTTP_PROXY', 'https_proxy', 'http_proxy', 'GLOBAL_AGENT_HTTPS_PROXY']) delete e[k];
        return e;
      })() },
  );
  let log = '';
  worker.stdout.on('data', (d) => (log += d));
  worker.stderr.on('data', (d) => (log += d));
  worker.on('exit', (c) => c && console.error(log));
  await waitFor(`${API}/health`);
});

after(async () => {
  worker?.kill('SIGTERM');
  await new Promise((r) => setTimeout(r, 300));
  worker?.kill('SIGKILL');
  await mock?.close();
});

describe('billing flow (test mode)', () => {
  const installA = randomUUID();
  const installB = randomUUID();

  it('serves public config: testnet, both currencies, friendly testnet address', async () => {
    const { status, body } = await api('/v1/config');
    assert.equal(status, 200);
    assert.equal(body.testMode, true);
    assert.deepEqual(body.currencies, ['USDT', 'TON']);
    assert.match(body.payTo, /^0Q/);
    assert.equal(body.plans.pro_annual.priceCents, 2900);
  });

  it('CORS allows extensions and the website, not random sites', async () => {
    const ok = await fetch(`${API}/v1/config`, { headers: { origin: 'http://localhost:3000' } });
    assert.equal(ok.headers.get('access-control-allow-origin'), 'http://localhost:3000');
    const bad = await fetch(`${API}/v1/config`, { headers: { origin: 'https://evil.example' } });
    assert.equal(bad.headers.get('access-control-allow-origin'), null);
  });

  it('validates input', async () => {
    assert.equal((await api('/v1/invoices', { method: 'POST', body: JSON.stringify({ installId: 'x', plan: 'pro_monthly', currency: 'TON' }) })).status, 400);
    assert.equal((await api('/v1/invoices', { method: 'POST', body: JSON.stringify({ installId: installA, plan: 'gold', currency: 'TON' }) })).status, 400);
    assert.equal((await api('/v1/invoices', { method: 'POST', body: JSON.stringify({ installId: installA, plan: 'business_monthly', seats: 0, currency: 'USDT' }) })).status, 400);
    assert.equal((await api('/v1/invoices', { method: 'POST', body: '{bad' })).status, 400);
  });

  it('free until paid', async () => {
    const { body } = await api(`/v1/entitlement?installId=${installA}`);
    assert.equal(body.tier, 'free');
  });

  let tonInvoice;
  it('creates a TON invoice priced at the current rate', async () => {
    const { status, body } = await api('/v1/invoices', { method: 'POST', body: JSON.stringify({ installId: installA, plan: 'pro_monthly', currency: 'TON' }) });
    assert.equal(status, 201);
    assert.equal(body.amount, '1247000000'); // 3.99 / 3.2 rounded up to 0.001 TON
    assert.equal(body.amountDisplay, '1.247');
    assert.match(body.comment, /^QR-[A-Z2-9]{8}$/);
    assert.match(body.link, /^ton:\/\/transfer\/0Q.+amount=1247000000&text=QR-/);
    assert.equal(body.status, 'pending');
    tonInvoice = body;
  });

  it('other installs cannot read the invoice', async () => {
    assert.equal((await api(`/v1/invoices/${tonInvoice.id}?installId=${installB}`)).status, 404);
  });

  it('an underpayment does not settle it', async () => {
    await pushEvent(chainEvent({ id: 'ev-under', amount: 1_000_000_000, comment: tonInvoice.comment }));
    const { body } = await api(`/v1/invoices/${tonInvoice.id}?installId=${installA}`);
    assert.equal(body.status, 'pending');
  });

  it('the correct payment settles it and issues Pro (script → subscription)', async () => {
    await pushEvent(chainEvent({ id: 'ev-ton-ok', amount: 1_247_000_000, comment: tonInvoice.comment }));
    await new Promise((r) => setTimeout(r, 8_500)); // scan throttle
    const { body } = await api(`/v1/invoices/${tonInvoice.id}?installId=${installA}`);
    assert.equal(body.status, 'paid');
    assert.match(body.licenseKey, /^QR(-[A-Z2-9]{4}){4}$/);
    const ent = (await api(`/v1/entitlement?installId=${installA}`)).body;
    assert.equal(ent.tier, 'pro');
    assert.equal(ent.licenseKey, body.licenseKey);
    const days = (ent.expiresAt - Date.now()) / 86_400_000;
    assert.ok(days > 29.9 && days < 30.1, `expected ~30 days, got ${days}`);
    tonInvoice = body;
  });

  it('the TonAPI key is sent as a Bearer token', () => {
    assert.ok(mock.requests.some((r) => r.auth === 'Bearer test-key-123'));
  });

  it('a second purchase of the same tier extends the same license', async () => {
    const { body: inv2 } = await api('/v1/invoices', { method: 'POST', body: JSON.stringify({ installId: installA, plan: 'pro_annual', currency: 'USDT' }) });
    assert.equal(inv2.amount, '29000000');
    await pushEvent(chainEvent({ id: 'ev-usdt-ok', amount: 29_000_000, comment: inv2.comment, type: 'JettonTransfer' }));
    await new Promise((r) => setTimeout(r, 8_500));
    const { body } = await api(`/v1/invoices/${inv2.id}?installId=${installA}`);
    assert.equal(body.status, 'paid');
    assert.equal(body.licenseKey, tonInvoice.licenseKey);
    const ent = (await api(`/v1/entitlement?installId=${installA}`)).body;
    const days = (ent.expiresAt - Date.now()) / 86_400_000;
    assert.ok(days > 394.9 && days < 395.1, `expected ~395 days, got ${days}`);
  });

  it('a fake "USDT" jetton (own master, or real master spoofed) does not pay', async () => {
    const { body: inv3 } = await api('/v1/invoices', { method: 'POST', body: JSON.stringify({ installId: installB, plan: 'pro_monthly', currency: 'USDT' }) });
    await pushEvent(chainEvent({ id: 'ev-fake', amount: 3_990_000, comment: inv3.comment, type: 'JettonTransfer', master: PAYER, jettonWallet: PAYER }));
    // A token that claims the real USDT master in its metadata but arrives through another jetton wallet
    await pushEvent(chainEvent({ id: 'ev-spoof', amount: 3_990_000, comment: inv3.comment, type: 'JettonTransfer', jettonWallet: '0:' + 'd'.repeat(64) }));
    await new Promise((r) => setTimeout(r, 8_500));
    const { body } = await api(`/v1/invoices/${inv3.id}?installId=${installB}`);
    assert.equal(body.status, 'pending');
  });

  it('B2B: Business for 3 seats, license works on 3 installs, 4th is refused', async () => {
    const admin = randomUUID();
    const { body: inv } = await api('/v1/invoices', { method: 'POST', body: JSON.stringify({ installId: admin, plan: 'business_monthly', seats: 3, currency: 'USDT' }) });
    assert.equal(inv.amount, '23970000');
    assert.equal(inv.usdCents, 2397);
    await pushEvent(chainEvent({ id: 'ev-biz', amount: 23_970_000, comment: inv.comment, type: 'JettonTransfer' }));
    await new Promise((r) => setTimeout(r, 8_500));
    const paid = (await api(`/v1/invoices/${inv.id}?installId=${admin}`)).body;
    assert.equal(paid.status, 'paid');
    const key = paid.licenseKey;
    const members = [randomUUID(), randomUUID()];
    for (const m of members) {
      const r = await api('/v1/licenses/activate', { method: 'POST', body: JSON.stringify({ installId: m, licenseKey: key.toLowerCase() }) });
      assert.equal(r.status, 200);
      assert.equal(r.body.tier, 'business');
      assert.equal(r.body.seats, 3);
    }
    const fourth = await api('/v1/licenses/activate', { method: 'POST', body: JSON.stringify({ installId: randomUUID(), licenseKey: key }) });
    assert.equal(fourth.status, 409);
    // a member leaves → seat frees up
    await api('/v1/licenses/deactivate', { method: 'POST', body: JSON.stringify({ installId: members[0], licenseKey: key }) });
    const again = await api('/v1/licenses/activate', { method: 'POST', body: JSON.stringify({ installId: randomUUID(), licenseKey: key }) });
    assert.equal(again.status, 200);
  });

  it('the minute cron settles payments even if nobody has the checkout page open', async () => {
    const buyer = randomUUID();
    const { body: inv } = await api('/v1/invoices', { method: 'POST', body: JSON.stringify({ installId: buyer, plan: 'pro_monthly', currency: 'USDT' }) });
    await pushEvent(chainEvent({ id: 'ev-cron', amount: 3_990_000, comment: inv.comment, type: 'JettonTransfer' }));
    await new Promise((r) => setTimeout(r, 8_500)); // let the poll throttle window pass so only cron can scan
    const cron = await fetch(`${API}/cdn-cgi/handler/scheduled?cron=*+*+*+*+*`);
    assert.equal(cron.status, 200);
    await new Promise((r) => setTimeout(r, 1_500));
    const ent = (await api(`/v1/entitlement?installId=${buyer}`)).body;
    assert.equal(ent.tier, 'pro');
  });

  it('unknown or malformed license keys are rejected', async () => {
    assert.equal((await api('/v1/licenses/activate', { method: 'POST', body: JSON.stringify({ installId: installB, licenseKey: 'QR-AAAA-BBBB-CCCC-DDDD' }) })).status, 404);
    assert.equal((await api('/v1/licenses/activate', { method: 'POST', body: JSON.stringify({ installId: installB, licenseKey: 'hello' }) })).status, 400);
  });

  it('replaying the same on-chain event never pays twice', async () => {
    const { body: inv } = await api('/v1/invoices', { method: 'POST', body: JSON.stringify({ installId: installB, plan: 'pro_monthly', currency: 'TON' }) });
    // same event id as an already-used payment, but with this invoice's comment
    await pushEvent(chainEvent({ id: 'ev-ton-ok', amount: 1_247_000_000, comment: inv.comment }));
    await new Promise((r) => setTimeout(r, 8_500));
    assert.equal((await api(`/v1/invoices/${inv.id}?installId=${installB}`)).body.status, 'pending');
  });
});
