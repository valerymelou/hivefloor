import { Hono } from 'hono';
import { officeConfig, publicConfig } from './config.js';
import { OFFICE_NAME, type Env } from './env.js';
import { REJECTION_STATUS, verifyIngest } from './ingest/verify.js';

/** How long `/api/snapshot` may be cached (R6). */
export const SNAPSHOT_MAX_AGE_SEC = 5;
/** How long `/api/config` may be cached. */
export const CONFIG_MAX_AGE_SEC = 60;

const bare = (status: number): Response => new Response(null, { status });

/**
 * The relay's routes. Responses to `/ingest` carry only a status code (R1), and
 * nothing here logs request bodies or headers.
 */
export const app = new Hono<{ Bindings: Env }>();

app.use('*', async (c, next) => {
  await next();
  // A WebSocket upgrade response has immutable headers; it carries no content anyway.
  if (c.res.status === 101) return;
  c.res.headers.set('x-content-type-options', 'nosniff');
  c.res.headers.set('referrer-policy', 'no-referrer');
  // `hivefloor doctor` compares clocks with it (H8); local workerd doesn't add one.
  if (!c.res.headers.has('date')) c.res.headers.set('date', new Date().toUTCString());
});

app.post('/ingest', async (c) => {
  const config = officeConfig(c.env.OFFICE_CONFIG);
  const secret = c.env.HIVEFLOOR_SECRET;
  if (config === undefined || secret === undefined || secret.length === 0)
    return bare(REJECTION_STATUS.unavailable);
  const now = Date.now();
  const verified = await verifyIngest(c.req.raw, secret, config, Math.floor(now / 1000));
  if (!verified.ok) return bare(REJECTION_STATUS[verified.reason]);
  if (verified.dryRun || verified.hidden) return bare(204);
  const outcome = await c.env.OFFICE.getByName(OFFICE_NAME).ingest(
    verified.event,
    verified.signature,
    now,
  );
  return bare(outcome === 'replay' ? REJECTION_STATUS.replay : 204);
});

app.get('/live', (c) => {
  if (c.req.header('upgrade')?.toLowerCase() !== 'websocket') return bare(426);
  return c.env.OFFICE.getByName(OFFICE_NAME).fetch(c.req.raw);
});

app.get('/api/config', (c) => {
  const config = officeConfig(c.env.OFFICE_CONFIG);
  if (config === undefined) return bare(503);
  return c.json(publicConfig(config), 200, {
    'cache-control': `public, max-age=${String(CONFIG_MAX_AGE_SEC)}`,
  });
});

app.get('/api/snapshot', async (c) => {
  const snapshot = await c.env.OFFICE.getByName(OFFICE_NAME).snapshot(Date.now());
  return c.json(snapshot, 200, {
    'cache-control': `public, max-age=${String(SNAPSHOT_MAX_AGE_SEC)}`,
  });
});

app.notFound(() => bare(404));
app.onError(() => bare(500));
