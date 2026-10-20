// Minimal leaderboard API, used both as Vite dev middleware and by server.mjs.
// Storage: a JSON file in ../data. Scores are submitted by clients and are not verified.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';

const DATA_DIR = new URL('../data/', import.meta.url);
const DATA_FILE = new URL('leaderboard.json', DATA_DIR);
const MAX_ENTRIES = 500;
const MAX_BODY = 16 * 1024;

let cache = null;
let writeChain = Promise.resolve();

async function load() {
  if (cache) return cache;
  try {
    cache = JSON.parse(await readFile(DATA_FILE, 'utf8'));
    if (!Array.isArray(cache)) cache = [];
  } catch {
    cache = [];
  }
  return cache;
}

function persist() {
  writeChain = writeChain
    .then(async () => {
      await mkdir(DATA_DIR, { recursive: true });
      await writeFile(DATA_FILE, JSON.stringify(cache, null, 1));
    })
    .catch((err) => console.error('[leaderboard] write failed', err));
  return writeChain;
}

const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const num = (v, min, max) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min;
};

function sanitize(body) {
  const pilot = str(body.pilot, 32);
  if (!pilot) throw new Error('Pilotname fehlt');
  return {
    id: randomUUID(),
    pilot,
    score: Math.round(num(body.score, 0, 10_000_000)),
    tricks: Math.round(num(body.tricks, 0, 10_000)),
    best: str(body.best, 40),
    maxCombo: Math.round(num(body.maxCombo, 0, 1000)),
    craft: str(body.craft, 40),
    duration: num(body.duration, 0, 24 * 3600),
    createdAt: new Date().toISOString(),
  };
}

function send(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(new Error('Request zu groß'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

export function leaderboardMiddleware() {
  return async (req, res, next) => {
    const url = new URL(req.url ?? '/', 'http://local');
    if (url.pathname !== '/api/leaderboard') return next ? next() : false;
    try {
      const entries = await load();
      if (req.method === 'GET') {
        const limit = Math.round(num(url.searchParams.get('limit') ?? 50, 1, 200));
        return send(res, 200, { entries: entries.slice(0, limit) });
      }
      if (req.method === 'POST') {
        const entry = sanitize(JSON.parse(await readBody(req)));
        entries.push(entry);
        entries.sort((a, b) => b.score - a.score);
        entries.length = Math.min(entries.length, MAX_ENTRIES);
        await persist();
        const rank = entries.findIndex((e) => e.id === entry.id) + 1;
        return send(res, 201, { entry, rank });
      }
      return send(res, 405, { error: 'Methode nicht erlaubt' });
    } catch (err) {
      return send(res, 400, { error: err instanceof Error ? err.message : 'Ungültige Anfrage' });
    }
  };
}
