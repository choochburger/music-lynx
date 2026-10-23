import 'dotenv/config';
import express from 'express';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createResolver, ResolveError } from './resolver.js';

const production = process.env.NODE_ENV === 'production' || fileURLToPath(import.meta.url).includes('/build/server/');
const app = express();
app.disable('x-powered-by');
const resolveMusic = createResolver(process.env.MUSICLINK_API_KEY, fetch, process.env.QOBUZ_APP_ID);
const visitors = new Map<string, { count: number; expires: number }>();

app.get('/api/resolve', async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const input = req.query.url;
  if (typeof input !== 'string' || input.length > 2048) {
    res.status(400).json({ error: 'Provide one song or album URL.' });
    return;
  }
  const now = Date.now();
  for (const [ip, entry] of visitors) if (entry.expires <= now) visitors.delete(ip);
  const ip = req.ip ?? 'local';
  const entry = visitors.get(ip) ?? { count: 0, expires: now + 60_000 };
  if (entry.count >= 10 || (!visitors.has(ip) && visitors.size >= 10_000)) {
    res.setHeader('Retry-After', '60');
    res.status(429).json({ error: 'Too many lookups. Give it a minute and try again.' });
    return;
  }
  entry.count += 1;
  visitors.set(ip, entry);
  try { res.json(await resolveMusic(input)); }
  catch (error) {
    const known = error instanceof ResolveError;
    res.status(known ? error.status : 500).json({ error: known ? error.message : 'Something went wrong. Please try again.' });
  }
});
app.use('/api', (_req, res) => { res.status(404).json({ error: 'API route not found.' }); });

if (production) {
  const dist = resolve(dirname(fileURLToPath(import.meta.url)), '../../dist');
  app.use(express.static(dist));
  app.get('/{*path}', (_req, res) => { res.sendFile(resolve(dist, 'index.html')); });
} else {
  const { createServer } = await import('vite');
  const vite = await createServer({ server: { middlewareMode: true }, appType: 'spa' });
  app.use(vite.middlewares);
}

const port = Number(process.env.PORT ?? (production ? 3000 : 5173));
const host = process.env.HOST ?? '127.0.0.1';
const server = app.listen(port, host, () => {
  console.log(`Music Lynx is ready at http://${host}:${port}`);
  if (!process.env.MUSICLINK_API_KEY) console.log('Add MUSICLINK_API_KEY to .env to enable live music matching.');
});
server.on('error', (error) => { console.error(error.message); process.exitCode = 1; });
