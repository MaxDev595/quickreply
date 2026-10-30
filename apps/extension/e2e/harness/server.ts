/**
 * Test harness server.
 * - /ext/*        built extension pages (dist/) with the chrome.* shim injected
 * - /fixtures/*   test pages with the shim + the real built content.js injected
 * - /__store      shared "chrome.storage.local" (GET / POST {set, remove})
 * - /__reset      replace the whole store
 * - /__events     Server-Sent Events stream of storage changes (chrome.storage.onChanged)
 */
import { readFile, writeFile } from 'node:fs/promises';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '../..');
// A build without plans/limits (npm run build:local); the tests create many snippets.
const DIST = join(ROOT, process.env.QR_DIST ?? 'dist-local');
const FIXTURES = join(ROOT, 'e2e/fixtures');
const FIXTURES_BUILD = join(ROOT, 'e2e/.fixtures-build');

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml',
};

type Store = Record<string, unknown>;

export interface Harness {
  port: number;
  base: string;
  close: () => Promise<void>;
}

export async function startHarness(port: number, persistFile: string): Promise<Harness> {
  let store: Store = {};
  try {
    store = JSON.parse(await readFile(persistFile, 'utf8')) as Store;
  } catch {
    store = {};
  }
  let version = 0;
  const clients = new Set<ServerResponse>();
  const base = `http://127.0.0.1:${port}`;
  const manifest = await readFile(join(DIST, 'manifest.json'), 'utf8');
  const shimSource = (await readFile(join(ROOT, 'e2e/harness/chrome-shim.js'), 'utf8'))
    .replace('__QR_BASE__', base)
    .replace('const MANIFEST = __QR_MANIFEST__;', `const MANIFEST = ${manifest};`);
  const shimTag = `<script>${shimSource}</script>`;

  const persist = () => writeFile(persistFile, JSON.stringify(store)).catch(() => undefined);

  const broadcast = (changes: Record<string, { oldValue?: unknown; newValue?: unknown }>) => {
    version++;
    const payload = `data: ${JSON.stringify({ version, changes })}\n\n`;
    for (const c of clients) c.write(payload);
    void persist();
  };

  const readBody = (req: IncomingMessage) =>
    new Promise<string>((ok) => {
      let data = '';
      req.on('data', (chunk: Buffer) => (data += chunk.toString()));
      req.on('end', () => ok(data));
    });

  const send = (res: ServerResponse, status: number, body: string | Buffer, type = 'text/plain') => {
    res.writeHead(status, { 'content-type': type, 'access-control-allow-origin': '*', 'cache-control': 'no-store' });
    res.end(body);
  };

  const server: Server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', base);
    const path = decodeURIComponent(url.pathname);
    try {
      if (path === '/__store' && req.method === 'GET') return send(res, 200, JSON.stringify({ version, data: store }), TYPES['.json']);
      if (path === '/__store' && req.method === 'POST') {
        const { set = {}, remove = [] } = JSON.parse(await readBody(req)) as { set?: Store; remove?: string[] };
        const changes: Record<string, { oldValue?: unknown; newValue?: unknown }> = {};
        for (const [k, v] of Object.entries(set)) {
          changes[k] = { oldValue: store[k], newValue: v };
          store[k] = v;
        }
        for (const k of remove) {
          changes[k] = { oldValue: store[k] };
          delete store[k];
        }
        broadcast(changes);
        return send(res, 200, JSON.stringify({ version }), TYPES['.json']);
      }
      if (path === '/__reset' && req.method === 'POST') {
        const next = JSON.parse(await readBody(req)) as Store;
        const changes: Record<string, { oldValue?: unknown; newValue?: unknown }> = {};
        for (const k of new Set([...Object.keys(store), ...Object.keys(next)])) changes[k] = { oldValue: store[k], newValue: next[k] };
        store = next;
        broadcast(changes);
        return send(res, 200, JSON.stringify({ version }), TYPES['.json']);
      }
      if (path === '/__events') {
        res.writeHead(200, {
          'content-type': 'text/event-stream',
          'cache-control': 'no-store',
          connection: 'keep-alive',
          'access-control-allow-origin': '*',
        });
        res.write(': open\n\n');
        clients.add(res);
        req.on('close', () => clients.delete(res));
        res.on('error', () => clients.delete(res));
        return;
      }

      let file: string | null = null;
      let inject: 'page' | 'fixture' | null = null;
      if (path.startsWith('/ext/')) {
        file = normalize(join(DIST, path.slice(5)));
        if (!file.startsWith(DIST)) return send(res, 403, 'forbidden');
        if (file.endsWith('.html')) inject = 'page';
      } else if (path.startsWith('/fixtures-build/')) {
        file = normalize(join(FIXTURES_BUILD, path.slice(16)));
        if (!file.startsWith(FIXTURES_BUILD)) return send(res, 403, 'forbidden');
      } else if (path.startsWith('/fixtures/')) {
        file = normalize(join(FIXTURES, path.slice(10)));
        if (!file.startsWith(FIXTURES)) return send(res, 403, 'forbidden');
        if (file.endsWith('.html')) inject = 'fixture';
      }
      if (!file) return send(res, 404, 'not found');

      let body: string | Buffer = await readFile(file);
      if (inject === 'page') body = body.toString().replace('<head>', `<head>${shimTag}`);
      if (inject === 'fixture') {
        const content = await readFile(join(DIST, 'content.js'), 'utf8');
        body = body.toString().replace('</body>', `${shimTag}<script>${content}</script></body>`);
      }
      return send(res, 200, body, TYPES[extname(file)] ?? 'application/octet-stream');
    } catch {
      return send(res, 404, 'not found');
    }
  });

  // Heartbeat: writes to dead SSE connections fail, which removes them.
  const heartbeat = setInterval(() => {
    for (const c of clients) {
      if (c.destroyed || c.writableEnded) clients.delete(c);
      else c.write(': ping\n\n');
    }
  }, 2000);
  await new Promise<void>((ok) => server.listen(port, '0.0.0.0', ok));
  return {
    port,
    base,
    close: () =>
      new Promise<void>((ok) => {
        clearInterval(heartbeat);
        for (const c of clients) c.end();
        server.closeAllConnections();
        server.close(() => ok());
      }),
  };
}
