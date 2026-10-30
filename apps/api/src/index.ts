/**
 * QuickReply billing API (Cloudflare Worker).
 *
 *   GET  /v1/config                          public config (network, currencies, test mode)
 *   POST /v1/invoices                        { installId, plan, seats?, currency } → invoice
 *   GET  /v1/invoices/:id?installId=…        invoice status (triggers a throttled chain scan)
 *   GET  /v1/entitlement?installId=…         current plan of this browser
 *   POST /v1/licenses/activate               { installId, licenseKey }
 *   POST /v1/licenses/deactivate             { installId, licenseKey }
 *
 * A cron trigger scans the receiving wallet every minute, so invoices are
 * settled even if nobody keeps the checkout page open.
 */
import { PLANS } from '@quickreply/shared';
import { Billing, HttpError, type Env } from './billing';

function corsHeaders(req: Request, env: Env): Record<string, string> {
  const origin = req.headers.get('Origin');
  if (!origin) return {};
  const allowed = env.ALLOWED_ORIGINS.split(',').map((s) => s.trim());
  const ok = allowed.some((a) => a === origin || (a === 'chrome-extension://*' && origin.startsWith('chrome-extension://')));
  if (!ok) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '600',
    Vary: 'Origin',
  };
}

function json(data: unknown, status: number, cors: Record<string, string>): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...cors },
  });
}

async function body(req: Request): Promise<Record<string, unknown>> {
  if (Number(req.headers.get('Content-Length') ?? 0) > 4096) throw new HttpError(413, 'Request too large');
  try {
    const data = (await req.json()) as unknown;
    if (typeof data !== 'object' || data === null || Array.isArray(data)) throw new Error();
    return data as Record<string, unknown>;
  } catch {
    throw new HttpError(400, 'Invalid JSON body');
  }
}

export async function handle(req: Request, env: Env, billing = new Billing(env)): Promise<Response> {
  const cors = corsHeaders(req, env);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  const url = new URL(req.url);
  const path = url.pathname.replace(/\/+$/, '');
  try {
    if (req.method === 'GET' && path === '/v1/config') return json({ ...(await billing.publicConfig()), plans: PLANS }, 200, cors);
    if (req.method === 'POST' && path === '/v1/invoices') return json(await billing.createInvoice(await body(req)), 201, cors);
    const inv = /^\/v1\/invoices\/([0-9a-f-]{36})$/.exec(path);
    if (req.method === 'GET' && inv) return json(await billing.getInvoice(inv[1]!, url.searchParams.get('installId')), 200, cors);
    if (req.method === 'GET' && path === '/v1/entitlement') return json(await billing.entitlement(url.searchParams.get('installId')), 200, cors);
    if (req.method === 'POST' && path === '/v1/licenses/activate') return json(await billing.activate(await body(req)), 200, cors);
    if (req.method === 'POST' && path === '/v1/licenses/deactivate') return json(await billing.deactivate(await body(req)), 200, cors);
    if (req.method === 'GET' && path === '/health') return json({ ok: true }, 200, cors);
    return json({ error: 'Not found' }, 404, cors);
  } catch (e) {
    if (e instanceof HttpError) return json({ error: e.message }, e.status, cors);
    console.error('billing error', (e as Error).message);
    return json({ error: 'Internal error' }, 500, cors);
  }
}

export default {
  fetch: (req: Request, env: Env) => handle(req, env),
  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(
      new Billing(env).scan().then(
        (n) => n > 0 && console.log(`settled ${n} invoice(s)`),
        (e: Error) => console.error('scan failed', e.message),
      ),
    );
  },
} satisfies ExportedHandler<Env>;
