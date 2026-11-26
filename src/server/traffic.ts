import { listApps } from './apps.ts';
import { db, now } from './db.ts';

// Per-app traffic from the shared proxy's Prometheus metrics (Caddy `metrics { per_host }`, served on the proxy
// network at :9180, see setup-server.sh in klin-dom). The counters are cumulative, so each minute's reading is stored
// as the difference from the previous one.
const URL = process.env.PROXY_METRICS_URL ?? 'http://proxy-caddy-1:9180/metrics';
const POLL_MS = 60_000;

export const trafficSource = { ok: false, detail: 'Not read yet' };

export interface Totals {
  req: number; // requests
  c4: number; // 4xx responses
  c5: number; // 5xx responses
  bytes: number; // response bytes
  dur: number; // summed request durations, seconds
}

const LINE = /^(caddy_http_request_duration_seconds_count|caddy_http_request_duration_seconds_sum|caddy_http_response_size_bytes_sum)\{(.*)\}\s+(\S+)/;
const LABEL = /(\w+)="((?:[^"\\]|\\.)*)"/g;

/**
 * Sums Caddy's counters per host. A request passes through several nested handlers (e.g. subroute → reverse_proxy)
 * and is counted once for each, so per host and status code only the handler that saw the most requests (the outermost)
 * is used; methods are added up.
 */
export function parseMetrics(text: string): Map<string, Totals> {
  type Cell = { count: number; dur: number; bytes: number };
  const cells = new Map<string, Map<string, Cell>>(); // `${host}\t${code}` -> handler -> cell
  for (const line of text.split('\n')) {
    const m = LINE.exec(line);
    if (!m) continue;
    const labels: Record<string, string> = {};
    for (const l of m[2].matchAll(LABEL)) labels[l[1]] = l[2];
    const host = labels.host;
    if (!host || host === '_other') continue;
    const value = Number(m[3]);
    if (!isFinite(value)) continue;
    const key = `${host}\t${labels.code ?? ''}`;
    const byHandler = cells.get(key) ?? new Map<string, Cell>();
    cells.set(key, byHandler);
    const cell = byHandler.get(labels.handler ?? '') ?? { count: 0, dur: 0, bytes: 0 };
    byHandler.set(labels.handler ?? '', cell);
    if (m[1].endsWith('_count')) cell.count += value;
    else if (m[1].startsWith('caddy_http_request_duration')) cell.dur += value;
    else cell.bytes += value;
  }
  const totals = new Map<string, Totals>();
  for (const [key, byHandler] of cells) {
    const [host, code] = key.split('\t');
    const top = [...byHandler.values()].reduce((a, b) => (b.count > a.count ? b : a));
    const t = totals.get(host) ?? { req: 0, c4: 0, c5: 0, bytes: 0, dur: 0 };
    t.req += top.count;
    if (code.startsWith('4')) t.c4 += top.count;
    if (code.startsWith('5')) t.c5 += top.count;
    t.bytes += top.bytes;
    t.dur += top.dur;
    totals.set(host, t);
  }
  return totals;
}

const FIELDS = ['req', 'c4', 'c5', 'bytes', 'dur'] as const;

/** Difference between two readings; a counter that went down means the proxy restarted, so the new value is the delta. */
export function delta(cur: Totals, prev: Totals | undefined): Totals {
  if (!prev || FIELDS.some((f) => cur[f] < prev[f])) return { ...cur };
  return { req: cur.req - prev.req, c4: cur.c4 - prev.c4, c5: cur.c5 - prev.c5, bytes: cur.bytes - prev.bytes, dur: cur.dur - prev.dur };
}

let prev: Map<string, Totals> | null = null;

export async function pollTraffic() {
  let cur: Map<string, Totals>;
  try {
    const res = await fetch(URL, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    cur = parseMetrics(await res.text());
  } catch (e) {
    Object.assign(trafficSource, { ok: false, detail: `Cannot read ${URL}: ${(e as Error).message}` });
    return;
  }
  Object.assign(trafficSource, { ok: true, detail: `Reading ${URL} (${cur.size} domains)` });
  if (prev) {
    // The first reading after a dashboard start only sets the baseline: what happened before it is unknown.
    const ts = Math.floor(now() / 60) * 60;
    const insert = db.prepare('INSERT OR REPLACE INTO traffic (ts, host, req, c4, c5, bytes, dur) VALUES (?,?,?,?,?,?,?)');
    for (const [host, t] of cur) {
      const d = delta(t, prev.get(host));
      if (d.req > 0 || d.bytes > 0) insert.run(ts, host, d.req, d.c4, d.c5, d.bytes, d.dur);
    }
  }
  prev = cur;
}

export function startTraffic() {
  pollTraffic();
  setInterval(pollTraffic, POLL_MS).unref();
}

export const TRAFFIC_RANGES: Record<string, number> = { '1h': 3600, '24h': 86400, '7d': 7 * 86400, '30d': 30 * 86400 };

/** Per app: totals over the range and requests per bucket (60 buckets), counting the app's domain and its www. alias. */
export function trafficByApp(range: string) {
  const span = TRAFFIC_RANGES[range] ?? TRAFFIC_RANGES['24h'];
  const bucket = Math.max(60, Math.round(span / 60 / 60) * 60);
  const end = Math.floor(now() / bucket) * bucket + bucket;
  const start = end - 60 * bucket;
  return listApps().map((app) => {
    const host = new globalThis.URL(app.url).hostname;
    const hosts = [host, `www.${host}`];
    const t = db
      .prepare(
        `SELECT COALESCE(SUM(req),0) AS req, COALESCE(SUM(c4),0) AS c4, COALESCE(SUM(c5),0) AS c5,
                COALESCE(SUM(bytes),0) AS bytes, COALESCE(SUM(dur),0) AS dur
         FROM traffic WHERE host IN (?, ?) AND ts >= ?`,
      )
      .get(...hosts, start) as unknown as Totals;
    const rows = db
      .prepare('SELECT CAST(ts / ? AS INTEGER) * ? AS b, SUM(req) AS req FROM traffic WHERE host IN (?, ?) AND ts >= ? GROUP BY b')
      .all(bucket, bucket, ...hosts, start) as { b: number; req: number }[];
    const byBucket = new Map(rows.map((r) => [r.b, r.req]));
    const series = Array.from({ length: 60 }, (_, i) => {
      const ts = start + i * bucket;
      return { ts, req: byBucket.get(ts) ?? 0 };
    });
    return {
      name: app.name,
      requests: t.req,
      errors4xx: t.c4,
      errors5xx: t.c5,
      bytes: t.bytes,
      avgMs: t.req ? Math.round((t.dur / t.req) * 1000) : null,
      bucketSeconds: bucket,
      series,
    };
  });
}
