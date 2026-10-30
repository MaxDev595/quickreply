// Serves the QA pages at http://localhost:4795 (no QuickReply code inside them).
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve } from 'node:path';

const root = resolve(import.meta.dirname, 'pages');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8' };

createServer(async (req, res) => {
  try {
    let p = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname);
    if (p.endsWith('/')) p += 'index.html';
    const file = normalize(join(root, p));
    if (!file.startsWith(root)) {
      res.writeHead(403).end('Forbidden');
      return;
    }
    // Read first, then send headers once: a missing file (e.g. /favicon.ico) is a 404, not a crash.
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream' });
    res.end(body);
  } catch {
    if (!res.headersSent) res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('Not found');
  }
}).listen(4795, () => console.log('QA pages: http://localhost:4795/'));
