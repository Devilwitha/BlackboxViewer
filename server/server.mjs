// Production server: serves the built app from ../dist and the leaderboard API.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { leaderboardMiddleware } from './leaderboard.mjs';

const PORT = Number(process.env.PORT ?? 8787);
const DIST = resolve(fileURLToPath(new URL('../dist/', import.meta.url)));
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
};

const api = leaderboardMiddleware();

async function serveStatic(req, res) {
  const pathname = decodeURIComponent(new URL(req.url ?? '/', 'http://local').pathname);
  let file = normalize(join(DIST, pathname));
  if (file !== DIST && !file.startsWith(DIST + sep)) {
    res.statusCode = 403;
    return res.end('Forbidden');
  }
  try {
    if ((await stat(file)).isDirectory()) file = join(file, 'index.html');
  } catch {
    file = join(DIST, 'index.html'); // SPA fallback
  }
  try {
    const body = await readFile(file);
    res.setHeader('Content-Type', TYPES[extname(file)] ?? 'application/octet-stream');
    res.end(body);
  } catch {
    res.statusCode = 404;
    res.end('Not found – erst "npm run build" ausführen.');
  }
}

createServer((req, res) => {
  api(req, res, () => serveStatic(req, res));
}).listen(PORT, () => console.log(`Blackbox Arena läuft auf http://localhost:${PORT}`));
