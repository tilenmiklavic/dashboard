import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import fs from 'node:fs';
import { Hono } from 'hono';
import { basicAuth } from 'hono/basic-auth';
import { apps, appStatus, containers, startChecks } from './apps.ts';
import { startCollector, hostInfo, latestSample, series, RANGES } from './collector.ts';
import { db, now, prune } from './db.ts';
import { startDeploys } from './deploys.ts';
import { keyNames, sshSource, startSsh } from './ssh.ts';

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

app.get('/api/ssh', (c) => {
  const names = keyNames();
  const day = now() - 86400;
  const week = now() - 7 * 86400;
  const logins = db
    .prepare("SELECT ts, user, ip, method, key_type AS keyType, fingerprint FROM ssh_events WHERE kind = 'login' ORDER BY ts DESC LIMIT 100")
    .all() as { fingerprint: string | null }[];
  const count = (sql: string, ...p: number[]) => (db.prepare(sql).get(...p) as { n: number }).n;
  const topFailed = db
    .prepare(
      `SELECT ip, COUNT(*) AS attempts, MAX(ts) AS last, GROUP_CONCAT(DISTINCT user) AS users
       FROM ssh_events WHERE kind = 'failed' AND ts >= ? GROUP BY ip ORDER BY attempts DESC LIMIT 25`,
    )
    .all(week) as { users: string | null }[];
  return c.json({
    source: sshSource,
    logins: logins.map((l) => ({ ...l, keyName: (l.fingerprint && names.get(l.fingerprint)) || null })),
    logins24h: count("SELECT COUNT(*) AS n FROM ssh_events WHERE kind = 'login' AND ts >= ?", day),
    failed24h: count("SELECT COUNT(*) AS n FROM ssh_events WHERE kind = 'failed' AND ts >= ?", day),
    failedIps24h: count("SELECT COUNT(DISTINCT ip) AS n FROM ssh_events WHERE kind = 'failed' AND ts >= ?", day),
    topFailed: topFailed.map((r) => ({ ...r, users: (r.users ?? '').split(',').filter(Boolean) })),
  });
});

app.get('/api/downtime', (c) => {
  const since = now() - 30 * 86400;
  const incidents = db
    .prepare('SELECT id, app, start, end, code, checks FROM incidents ORDER BY start DESC LIMIT 300')
    .all() as { app: string; start: number; end: number | null }[];
  const summary = apps.map((a) => {
    const recent = incidents.filter((i) => i.app === a.name && (i.end ?? now()) >= since);
    const seconds = recent.reduce((s, i) => s + (i.end ?? now()) - Math.max(i.start, since), 0);
    return { app: a.name, incidents30d: recent.length, downtime30d: seconds, ongoing: recent.some((i) => i.end == null) };
  });
  return c.json({ incidents, summary });
});

app.get('/api/deploys', (c) => {
  const names = keyNames();
  const deploys = db.prepare('SELECT id, app, ts, source, ref, info FROM deploys ORDER BY ts DESC LIMIT 300').all() as {
    app: string;
    ts: number;
  }[];
  // Who deployed: the SSH login as the app's user closest to the deploy (deploy.sh logs in as <app>).
  const by = db.prepare(
    "SELECT ip, fingerprint FROM ssh_events WHERE kind = 'login' AND user = ? AND ts BETWEEN ? AND ? ORDER BY ABS(ts - ?) LIMIT 1",
  );
  return c.json({
    deploys: deploys.map((d) => {
      const l = by.get(d.app, d.ts - 900, d.ts + 120, d.ts) as { ip: string; fingerprint: string | null } | undefined;
      return { ...d, by: l ? { ip: l.ip, keyName: (l.fingerprint && names.get(l.fingerprint)) || null } : null };
    }),
  });
});

// Built frontend (vite build -> dist/web), with SPA fallback.
const webRoot = './dist/web';
if (fs.existsSync(webRoot)) {
  app.use('*', serveStatic({ root: webRoot }));
  app.get('*', serveStatic({ root: webRoot, path: 'index.html' }));
}

startCollector();
startChecks();
startSsh();
startDeploys();
prune();
setInterval(prune, 6 * 3600_000).unref();

const port = Number(process.env.PORT ?? 3000);
serve({ fetch: app.fetch, port }, () => console.log(`dashboard listening on :${port}`));
