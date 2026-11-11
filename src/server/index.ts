import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import fs from 'node:fs';
import { Hono } from 'hono';
import { basicAuth } from 'hono/basic-auth';
import { apps, appStatus, containers, startChecks } from './apps.ts';
import { startCollector, hostInfo, latestSample, series, RANGES } from './collector.ts';
import { prune } from './db.ts';

const password = process.env.DASHBOARD_PASSWORD;
if (!password) {
  console.error('DASHBOARD_PASSWORD is not set; refusing to start an unauthenticated dashboard.');
  process.exit(1);
}

const app = new Hono();

// Health check for Docker, before auth.
app.get('/healthz', (c) => c.text('ok'));

app.use('*', basicAuth({ username: process.env.DASHBOARD_USER ?? 'admin', password }));

app.get('/api/overview', async (c) => {
  const [docker] = await Promise.all([containers()]);
  return c.json({
    host: hostInfo(),
    now: latestSample() ?? null,
    apps: apps.map((a) => ({
      ...appStatus(a),
      containers: docker.list.filter((x) => x.project === a.name),
    })),
    dockerAvailable: docker.available,
  });
});

app.get('/api/metrics', (c) => {
  const range = c.req.query('range') ?? '24h';
  if (!(range in RANGES)) return c.json({ error: 'range must be one of ' + Object.keys(RANGES).join(', ') }, 400);
  return c.json({ range, points: series(range) });
});

// Built frontend (vite build -> dist/web), with SPA fallback.
const webRoot = './dist/web';
if (fs.existsSync(webRoot)) {
  app.use('*', serveStatic({ root: webRoot }));
  app.get('*', serveStatic({ root: webRoot, path: 'index.html' }));
}

startCollector();
startChecks();
prune();
setInterval(prune, 6 * 3600_000).unref();

const port = Number(process.env.PORT ?? 3000);
serve({ fetch: app.fetch, port }, () => console.log(`dashboard listening on :${port}`));
