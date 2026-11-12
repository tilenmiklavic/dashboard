import fs from 'node:fs';
import http from 'node:http';
import { db, kvGet, kvSet, now } from './db.ts';

export interface AppConfig {
  /** The app's name: its route file name in the proxy, and its docker compose project name (the netcup convention). */
  name: string;
  url: string;
  /** Path to request for the health check, default "/". */
  healthPath?: string;
}

// Apps are discovered from the shared proxy's routes: every app installs /opt/proxy/sites/<app>.caddy, whose first site
// block that proxies to a container names the app's domain. apps.config.json only adjusts that list:
//   { "apps": [{ "name": "dashboard", "healthPath": "/healthz" }, { "name": "extra", "url": "https://…" }],
//     "ignore": ["some-app"] }
// An entry overrides the discovered app of the same name (url, healthPath); an entry with a url and no route adds an app.
const HOST_ROOT = process.env.HOST_ROOT ?? '/';
const SITES_DIR = process.env.PROXY_SITES_DIR ?? `${HOST_ROOT.replace(/\/$/, '')}/opt/proxy/sites`;
const CONFIG = process.env.APPS_CONFIG ?? './apps.config.json';

interface Config { apps?: Partial<AppConfig>[]; ignore?: string[] }
const config: Config = fs.existsSync(CONFIG) ? JSON.parse(fs.readFileSync(CONFIG, 'utf8')) : {};

/** The domain of the first site block in a Caddyfile snippet that uses reverse_proxy (skips redirect-only blocks). */
export function domainFromCaddy(text: string): string | null {
  const lines = text.split('\n').map((l) => l.replace(/#.*/, '').trim());
  let site: string | null = null;
  let depth = 0;
  for (const line of lines) {
    if (!line) continue;
    if (depth === 0 && line.endsWith('{')) site = line.slice(0, -1).trim().split(/[\s,]+/)[0] || null;
    if (depth >= 1 && site && /^reverse_proxy\b/.test(line)) return site.replace(/^https?:\/\//, '').replace(/:\d+$/, '');
    depth += (line.match(/{/g) ?? []).length - (line.match(/}/g) ?? []).length;
    if (depth === 0) site = null;
  }
  return null;
}

export let appsSource = { discovered: false, detail: '' };

export function listApps(): AppConfig[] {
  const found = new Map<string, AppConfig>();
  try {
    for (const f of fs.readdirSync(SITES_DIR).sort()) {
      if (!f.endsWith('.caddy') || f.startsWith('.')) continue;
      const domain = domainFromCaddy(fs.readFileSync(`${SITES_DIR}/${f}`, 'utf8'));
      if (domain && !domain.startsWith('*')) found.set(f.slice(0, -6), { name: f.slice(0, -6), url: `https://${domain}` });
    }
    appsSource = { discovered: true, detail: `${found.size} routes in ${SITES_DIR}` };
  } catch (e) {
    appsSource = { discovered: false, detail: `cannot read ${SITES_DIR}: ${(e as Error).message}` };
  }
  for (const o of config.apps ?? []) {
    if (!o.name) continue;
    const base = found.get(o.name);
    if (base) found.set(o.name, { ...base, ...o } as AppConfig);
    else if (o.url) found.set(o.name, o as AppConfig);
  }
  for (const name of config.ignore ?? []) found.delete(name);
  return [...found.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export const CHECK_INTERVAL_MS = 60_000;
const SLOW_MS = 1500;

export type Health = 'healthy' | 'degraded' | 'down' | 'idle';

async function check(app: AppConfig) {
  const t0 = performance.now();
  let code = 0;
  let ok = 0;
  try {
    const res = await fetch(new URL(app.healthPath ?? '/', app.url), { signal: AbortSignal.timeout(5000), redirect: 'follow' });
    code = res.status;
    ok = res.status < 400 ? 1 : 0;
    await res.body?.cancel();
  } catch {
    /* timeout / DNS / TLS: counts as down */
  }
  const ms = Math.round(performance.now() - t0);
  const ts = now();
  db.prepare('INSERT INTO checks (ts, app, ok, code, ms) VALUES (?,?,?,?,?)').run(ts, app.name, ok, code, ms);
  recordIncident(app.name, ts, ok, code);
}

// --- Downtime incidents -----------------------------------------------------------------------------------------------
// An incident starts at the first failed check and ends at the next successful one (an upper bound: the app came back
// somewhere between the last failed and that successful check).
function recordIncident(app: string, ts: number, ok: number, code: number) {
  const open = db.prepare('SELECT id FROM incidents WHERE app = ? AND end IS NULL').get(app) as { id: number } | undefined;
  if (!ok && !open) db.prepare('INSERT INTO incidents (app, start, end, code, checks) VALUES (?, ?, NULL, ?, 1)').run(app, ts, code);
  else if (!ok && open) db.prepare('UPDATE incidents SET checks = checks + 1, code = ? WHERE id = ?').run(code, open.id);
  else if (ok && open) db.prepare('UPDATE incidents SET end = ? WHERE id = ?').run(ts, open.id);
}

/** Builds incidents from the stored checks once, for the history collected before incidents existed. */
export function backfillIncidents() {
  if (kvGet('incidents_backfilled')) return;
  const rows = db.prepare('SELECT ts, app, ok, code FROM checks ORDER BY app, ts').all() as { ts: number; app: string; ok: number; code: number }[];
  db.exec('BEGIN');
  db.exec('DELETE FROM incidents');
  for (const r of rows) recordIncident(r.app, r.ts, r.ok, r.code);
  kvSet('incidents_backfilled', String(now()));
  db.exec('COMMIT');
}

export function startChecks() {
  backfillIncidents();
  const run = () => Promise.allSettled(listApps().map(check));
  run();
  setInterval(run, CHECK_INTERVAL_MS).unref();
}

export function appStatus(app: AppConfig) {
  const last = db.prepare('SELECT ts, ok, code, ms FROM checks WHERE app = ? ORDER BY ts DESC LIMIT 1').get(app.name) as
    | { ts: number; ok: number; code: number; ms: number }
    | undefined;
  const day = db
    .prepare('SELECT COUNT(*) AS n, SUM(ok) AS up, AVG(CASE WHEN ok = 1 THEN ms END) AS avg_ms FROM checks WHERE app = ? AND ts >= ?')
    .get(app.name, Math.floor(Date.now() / 1000) - 86400) as { n: number; up: number | null; avg_ms: number | null };
  const history = db
    .prepare('SELECT ts, ms FROM checks WHERE app = ? AND ok = 1 AND ts >= ? ORDER BY ts')
    .all(app.name, Math.floor(Date.now() / 1000) - 3 * 3600) as { ts: number; ms: number }[];

  let status: Health = 'idle';
  if (last) status = !last.ok ? 'down' : last.ms > SLOW_MS ? 'degraded' : 'healthy';
  return {
    name: app.name,
    url: app.url,
    status,
    code: last?.code ?? null,
    ms: last?.ok ? last.ms : null, // a failed check's time-to-failure says nothing about speed
    checkedAt: last?.ts ?? null,
    uptime24h: day.n ? (day.up ?? 0) / day.n : null,
    avgMs24h: day.avg_ms ? Math.round(day.avg_ms) : null,
    history: history.map((h) => h.ms),
  };
}

// --- Docker (read-only, over the unix socket) -------------------------------------------------------------------------
const SOCKET = process.env.DOCKER_SOCKET ?? '/var/run/docker.sock';

function dockerGet<T>(path: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const req = http.request({ socketPath: SOCKET, path, method: 'GET', timeout: 3000 }, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => (res.statusCode === 200 ? resolve(JSON.parse(body)) : reject(new Error(`docker ${res.statusCode}`))));
    });
    req.on('timeout', () => req.destroy(new Error('docker timeout')));
    req.on('error', reject);
    req.end();
  });
}

export interface ContainerInfo {
  id: string;
  created: number;
  service: string;
  name: string;
  project: string;
  image: string;
  state: string;
  status: string;
}

export async function containers(): Promise<{ available: boolean; list: ContainerInfo[] }> {
  try {
    const raw = await dockerGet<any[]>('/containers/json?all=true');
    return {
      available: true,
      list: raw.map((c) => ({
        id: String(c.Id),
        created: Number(c.Created),
        service: c.Labels?.['com.docker.compose.service'] ?? '',
        name: String(c.Names?.[0] ?? '').replace(/^\//, ''),
        project: c.Labels?.['com.docker.compose.project'] ?? '',
        image: c.Image,
        state: c.State,
        status: c.Status,
      })),
    };
  } catch {
    return { available: false, list: [] };
  }
}
