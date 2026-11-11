import { useEffect, useState } from 'react';

export interface Sample {
  ts: number; cpu: number; mem_used: number; mem_total: number;
  disk_used: number; disk_total: number; load1: number; rx: number; tx: number;
}
export interface Point { ts: number; cpu: number; mem_used: number; mem_total: number; load1: number; rx: number; tx: number }
export type Health = 'healthy' | 'degraded' | 'down' | 'idle';
export interface Container { name: string; image: string; state: string; status: string }
export interface AppInfo {
  name: string; url: string; status: Health; code: number | null; ms: number | null; checkedAt: number | null;
  uptime24h: number | null; avgMs24h: number | null; history: number[]; containers: Container[];
}
export interface Overview {
  host: { hostname: string; cores: number; uptime: number; netScope: 'host' | 'container' };
  now: Sample | null;
  apps: AppInfo[];
  dockerAvailable: boolean;
}

/** Polls a JSON endpoint; keeps the last good value if a refresh fails. */
export function usePoll<T>(url: string, intervalMs = 10_000) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`${res.status}`);
        const json = (await res.json()) as T;
        if (alive) { setData(json); setError(null); }
      } catch (e) {
        if (alive) setError(String(e));
      }
    };
    load();
    const id = setInterval(load, intervalMs);
    return () => { alive = false; clearInterval(id); };
  }, [url, intervalMs]);
  return { data, error };
}
