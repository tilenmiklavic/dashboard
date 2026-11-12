import fs from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { ReadableStream } from 'node:stream/web';
import zlib from 'node:zlib';
import maxmind, { type CityResponse, type Reader } from 'maxmind';

// Approximate IP locations from a local copy of DB-IP's free "IP to City Lite" database (CC BY 4.0, monthly,
// GeoIP2-compatible .mmdb). Looked up offline, so no IP ever leaves the server. Downloaded into the data volume on
// first start and refreshed when older than 35 days. GEOIP_URL overrides the source (an .mmdb or .mmdb.gz URL).
const DIR = path.join(path.dirname(process.env.DB_PATH ?? './data/dashboard.db'), 'geo');
const FILE = path.join(DIR, 'city.mmdb');
const MAX_AGE_MS = 35 * 86400_000;

export const geoSource = { ok: false, detail: 'Location database not loaded yet' };
let reader: Reader<CityResponse> | null = null;
const cache = new Map<string, string | null>();

function sourceUrls(): string[] {
  if (process.env.GEOIP_URL) return [process.env.GEOIP_URL];
  const d = new Date();
  const month = (y: number, m: number) => `${y}-${String(m + 1).padStart(2, '0')}`;
  const thisMonth = month(d.getUTCFullYear(), d.getUTCMonth());
  const prev = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1));
  // The new month's file can appear a few days late, so fall back to last month's.
  return [thisMonth, month(prev.getUTCFullYear(), prev.getUTCMonth())].map(
    (m) => `https://download.db-ip.com/free/dbip-city-lite-${m}.mmdb.gz`,
  );
}

async function download(): Promise<string> {
  fs.mkdirSync(DIR, { recursive: true });
  const errors: string[] = [];
  for (const url of sourceUrls()) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(120_000) });
      if (!res.ok || !res.body) {
        errors.push(`${url}: HTTP ${res.status}`);
        continue;
      }
      const tmp = FILE + '.tmp';
      const body = Readable.fromWeb(res.body as ReadableStream);
      if (url.endsWith('.gz')) await pipeline(body, zlib.createGunzip(), fs.createWriteStream(tmp));
      else await pipeline(body, fs.createWriteStream(tmp));
      fs.renameSync(tmp, FILE);
      return url;
    } catch (e) {
      errors.push(`${url}: ${(e as Error).message}`);
    }
  }
  throw new Error(errors.join('; '));
}

let refreshing = false;
export async function refreshGeo() {
  if (refreshing) return;
  refreshing = true;
  try {
    const stale = !fs.existsSync(FILE) || Date.now() - fs.statSync(FILE).mtimeMs > MAX_AGE_MS;
    let note = '';
    if (stale) {
      try {
        note = `downloaded from ${await download()}`;
      } catch (e) {
        note = `download failed (${(e as Error).message})`;
        if (!fs.existsSync(FILE)) throw new Error(note);
      }
    }
    if (stale || !reader) {
      reader = await maxmind.open<CityResponse>(FILE);
      cache.clear();
    }
    const built = new Date(reader.metadata.buildEpoch).toISOString().slice(0, 10);
    Object.assign(geoSource, { ok: true, detail: `${reader.metadata.databaseType}, built ${built}${note ? `; ${note}` : ''}` });
  } catch (e) {
    Object.assign(geoSource, { ok: false, detail: (e as Error).message });
  } finally {
    refreshing = false;
  }
}

export function startGeo() {
  refreshGeo();
  setInterval(refreshGeo, 86400_000).unref();
}

const PRIVATE = /^(10\.|127\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|::1$|f[cd][0-9a-f]{2}:|fe80:)/i;

/** "City, Country" (or just the country), "Private network", or null when unknown or the database isn't loaded. */
export function locate(ip: string): string | null {
  if (PRIVATE.test(ip)) return 'Private network';
  if (!reader || !maxmind.validate(ip)) return null;
  if (cache.has(ip)) return cache.get(ip)!;
  const r = reader.get(ip);
  const city = r?.city?.names?.en;
  const country = r?.country?.names?.en ?? r?.registered_country?.names?.en;
  const label = city && country ? `${city}, ${country}` : (country ?? null);
  if (cache.size > 50_000) cache.clear();
  cache.set(ip, label);
  return label;
}
