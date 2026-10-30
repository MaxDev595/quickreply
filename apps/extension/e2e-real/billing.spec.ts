/**
 * End-to-end billing flow in real Chromium, test mode:
 *   extension (dist-testnet) → Settings → Upgrade → website checkout → invoice
 *   → on-chain payment (mock TonAPI) → server settles → extension shows the plan.
 * Also B2B: a Business license activated on a second browser profile.
 *
 * Needs: apps/website/out built with NEXT_PUBLIC_BILLING_API=http://127.0.0.1:8787,
 * dist-testnet built with VITE_BILLING_API=http://127.0.0.1:8787 VITE_SITE_URL=http://localhost:4790.
 * Run: QR_BILLING_E2E=1 npx playwright test -c playwright.real.config.ts billing
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { chromium, type BrowserContext, type Page } from '@playwright/test';
import { CHROME, expect, test } from './fixtures';

test.skip(!process.env.QR_BILLING_E2E, 'Set QR_BILLING_E2E=1 (needs the test-mode builds)');
test.describe.configure({ mode: 'serial' });

const ROOT = resolve(import.meta.dirname, '../../..');
const EXT = resolve(import.meta.dirname, '../dist-testnet');
const WALLET_RAW = '0:c037b6ae8013ccf15b697319797d56bf670df7bd303415fb883a5261e53093eb';
const USDT_RAW = '0:b113a994b5024a16719f69139328eb759596c38a25f59028b146fecdc3621dfe';
const MOCK = 'http://127.0.0.1:8786';

const procs: ChildProcess[] = [];
let mockClose: (() => Promise<void>) | null = null;

async function waitFor(url: string, ms = 90_000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      /* starting */
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error(`timeout: ${url}`);
}

function noProxyEnv(extra: Record<string, string> = {}) {
  const e: Record<string, string> = { ...(process.env as Record<string, string>), CI: '1', WRANGLER_SEND_METRICS: 'false', ...extra };
  for (const k of ['HTTPS_PROXY', 'HTTP_PROXY', 'https_proxy', 'http_proxy', 'GLOBAL_AGENT_HTTPS_PROXY']) delete e[k];
  return e;
}

test.beforeAll(async () => {
  test.setTimeout(180_000);
  const { startMockTonApi } = (await import(join(ROOT, 'apps/api/test-int/mock-tonapi.mjs'))) as {
    startMockTonApi: (p: number) => Promise<{ close: () => Promise<void> }>;
  };
  mockClose = (await startMockTonApi(8786)).close;
  const state = join(ROOT, 'apps/api/.wrangler/e2e-state');
  await rm(state, { recursive: true, force: true });
  const apiDir = join(ROOT, 'apps/api');
  await new Promise<void>((ok, fail) => {
    const p = spawn('npx', ['wrangler', 'd1', 'migrations', 'apply', 'quickreply-billing', '--local', '--persist-to', state], { cwd: apiDir, env: noProxyEnv(), stdio: 'ignore' });
    p.on('exit', (c) => (c === 0 ? ok() : fail(new Error('migrations failed'))));
  });
  procs.push(
    spawn(
      'npx',
      [
        'wrangler', 'dev', '--port', '8787', '--ip', '127.0.0.1', '--persist-to', state,
        '--var', `TONAPI_BASE:${MOCK}`, '--var', `USDT_MASTERS:${USDT_RAW}`, '--var', 'TEST_PRICE_DIVISOR:100',
        '--var', 'ALLOWED_ORIGINS:http://localhost:4790,chrome-extension://*',
      ],
      { cwd: apiDir, env: noProxyEnv(), stdio: 'ignore' },
    ),
    spawn('node', ['scripts/serve-out.mjs'], { cwd: join(ROOT, 'apps/website'), env: { ...process.env, PORT: '4790' }, stdio: 'ignore' }),
  );
  await waitFor('http://127.0.0.1:8787/health');
  await waitFor('http://localhost:4790/pricing/');
});

test.afterAll(async () => {
  for (const p of procs) p.kill('SIGKILL');
  await mockClose?.();
});

async function launchExt(): Promise<{ context: BrowserContext; id: string }> {
  const context = await chromium.launchPersistentContext(await mkdtemp(join(tmpdir(), 'qr-bill-')), {
    executablePath: CHROME,
    headless: true,
    viewport: { width: 1280, height: 900 },
    args: ['--headless=new', '--no-sandbox', `--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`],
  });
  const p = await context.newPage();
  await p.goto('chrome://extensions');
  const id = (await p.evaluate(async () => (await chrome.management.getAll()).find((e) => e.name.startsWith('QuickReply'))?.id)) as string;
  await p.close();
  return { context, id };
}

async function pay(comment: string, amount: string, currency: 'USDT' | 'TON') {
  const action =
    currency === 'TON'
      ? { type: 'TonTransfer', status: 'ok', TonTransfer: { sender: { address: '0:' + '1'.repeat(64) }, recipient: { address: WALLET_RAW }, amount: Number(amount), comment } }
      : {
          type: 'JettonTransfer',
          status: 'ok',
          JettonTransfer: { sender: { address: '0:' + '1'.repeat(64) }, recipient: { address: WALLET_RAW }, amount, comment, jetton: { address: USDT_RAW, symbol: 'USD₮', decimals: 6 } },
        };
  await fetch(`${MOCK}/__events`, {
    method: 'POST',
    body: JSON.stringify({ event_id: `ev-${comment}`, timestamp: Math.floor(Date.now() / 1000), lt: Date.now(), in_progress: false, actions: [action] }),
  });
}

async function invoiceFromPage(page: Page) {
  const comment = (await page.locator('code').nth(1).innerText()).trim();
  const amountText = await page.getByText(/^\d+\.\d+ (USDT|TON)$/).innerText();
  return { comment, amountText };
}

let businessKey = '';

test('Pro Annual: Upgrade from the extension → pay USDT → plan active in the extension', async () => {
  test.setTimeout(120_000);
  const { context, id } = await launchExt();
  const settings = await context.newPage();
  await settings.goto(`chrome-extension://${id}/dashboard.html#/settings`);
  await expect(settings.getByTestId('current-plan')).toHaveText('Free');
  await expect(settings.getByText('Test mode: payments use TON testnet.')).toBeVisible();

  const checkoutPromise = context.waitForEvent('page');
  await settings.getByRole('button', { name: /Upgrade/ }).click();
  const checkout = await checkoutPromise;
  await checkout.waitForLoadState();
  expect(checkout.url()).toMatch(/localhost:4790\/pricing\/\?install=[0-9a-f-]{36}#checkout/);
  await expect(checkout.getByRole('note').filter({ hasText: 'Test mode' })).toBeVisible();

  await checkout.getByRole('radio', { name: /Pro Annual/ }).click();
  await checkout.getByRole('radio', { name: /USDT \(TON\)/ }).click();
  await checkout.getByRole('button', { name: 'Continue to payment' }).click();
  await expect(checkout.getByText('Waiting for payment')).toBeVisible();
  await expect(checkout.getByAltText(/Payment QR code/)).toBeVisible();
  const { comment, amountText } = await invoiceFromPage(checkout);
  expect(amountText).toBe('0.29 USDT'); // $29 / 100 in test mode
  expect(comment).toMatch(/^QR-[A-Z2-9]{8}$/);
  const href = new URL((await checkout.getByRole('link', { name: 'Open in wallet' }).getAttribute('href'))!);
  expect(href.protocol).toBe('ton:');
  expect(href.pathname.split('/').pop()).toMatch(/^0Q/); // testnet, non-bounceable
  expect(href.searchParams.get('amount')).toBe('290000');
  expect(href.searchParams.get('text')).toBe(comment);
  expect(href.searchParams.get('jetton')).toMatch(/^kQ/); // USDT master, testnet form
  await checkout.screenshot({ path: join(ROOT, 'docs/screenshots/checkout-invoice.png') });

  await pay(comment, '290000', 'USDT');
  await expect(checkout.getByText('Payment received')).toBeVisible({ timeout: 30_000 });
  await expect(checkout.getByText('active in your QuickReply extension')).toBeVisible();
  await checkout.screenshot({ path: join(ROOT, 'docs/screenshots/checkout-paid.png') });

  await settings.bringToFront();
  await settings.getByRole('button', { name: 'Refresh plan' }).click();
  await expect(settings.getByTestId('current-plan')).toHaveText('Pro Annual');
  await expect(settings.getByText(/Active until/)).toBeVisible();
  await settings.screenshot({ path: join(ROOT, 'docs/screenshots/extension-plan-pro.png') });
  await context.close();
});

test('B2B: Business 5 seats paid in TON, key activated on a team member’s browser', async () => {
  test.setTimeout(120_000);
  const admin = await launchExt();
  const settings = await admin.context.newPage();
  await settings.goto(`chrome-extension://${admin.id}/dashboard.html#/settings`);
  const checkoutPromise = admin.context.waitForEvent('page');
  await settings.getByRole('button', { name: /Upgrade/ }).click();
  const checkout = await checkoutPromise;
  await checkout.waitForLoadState();
  await checkout.getByRole('radio', { name: /Business/ }).click();
  await expect(checkout.getByRole('textbox', { name: 'Seats' })).toHaveValue('5');
  await expect(checkout.getByText('5 × $7.99')).toBeVisible();
  await expect(checkout.getByText('$39.95')).toBeVisible();
  await checkout.getByRole('radio', { name: /Toncoin/ }).click();
  await checkout.getByRole('button', { name: 'Continue to payment' }).click();
  await expect(checkout.getByText('Waiting for payment')).toBeVisible();
  const { comment, amountText } = await invoiceFromPage(checkout);
  // $39.95 / 100 = 40 cents at the mock rate of $3.20 → 0.125 TON
  expect(amountText).toBe('0.125 TON');
  await pay(comment, '125000000', 'TON');
  await expect(checkout.getByText('Payment received')).toBeVisible({ timeout: 30_000 });
  businessKey = (await checkout.locator('code').first().innerText()).trim();
  expect(businessKey).toMatch(/^QR(-[A-Z2-9]{4}){4}$/);
  await admin.context.close();

  const member = await launchExt();
  const ms = await member.context.newPage();
  await ms.goto(`chrome-extension://${member.id}/dashboard.html#/settings`);
  await expect(ms.getByTestId('current-plan')).toHaveText('Free');
  await ms.getByLabel('License key').fill(businessKey.toLowerCase());
  await ms.getByRole('button', { name: 'Activate license' }).click();
  await expect(ms.getByTestId('current-plan')).toHaveText('Business · 5 seats');
  await member.context.close();
});

test('a wrong license key shows a clear error', async () => {
  const { context, id } = await launchExt();
  const p = await context.newPage();
  await p.goto(`chrome-extension://${id}/dashboard.html#/settings`);
  await p.getByLabel('License key').fill('QR-AAAA-BBBB-CCCC-DDDD');
  await p.getByRole('button', { name: 'Activate license' }).click();
  await expect(p.getByRole('alert')).toHaveText('License key not found.');
  await expect(p.getByTestId('current-plan')).toHaveText('Free');
  await context.close();
});
