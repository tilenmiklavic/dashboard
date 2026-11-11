import fs from 'node:fs';
import http from 'node:http';
import { db } from './db.ts';

export interface AppConfig {
  /** Display name, also the docker compose project name (the netcup convention: one project per app). */
  name: string;
  url: string;
  /** Path to request for the health check, default "/". */
  healthPath?: string;
}

const CONFIG = process.env.APPS_CONFIG ?? './apps.config.json';
export const apps: AppConfig[] = JSON.parse(fs.readFileSync(CONFIG, 'utf8')).apps;
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
  db.prepare('INSERT INTO checks (ts, app, ok, code, ms) VALUES (?,?,?,?,?)').run(Math.floor(Date.now() / 1000), app.name, ok, code, ms);
}

export function startChecks() {
  const run = () => Promise.allSettled(apps.map(check));
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
