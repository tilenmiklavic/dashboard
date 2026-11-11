import fs from 'node:fs';
import os from 'node:os';
import { db } from './db.ts';

// /proc/stat, meminfo, loadavg and uptime are not namespaced by Docker, so they show the host even inside the container.
// Disk and network are: the compose file mounts the host root at HOST_ROOT and (optionally) the host /proc at HOST_PROC.
const HOST_ROOT = process.env.HOST_ROOT ?? '/';
const HOST_PROC = process.env.HOST_PROC ?? '/proc';
export const INTERVAL_MS = 15_000;

export interface Sample {
  ts: number;
  cpu: number;
  mem_used: number;
  mem_total: number;
  disk_used: number;
  disk_total: number;
  load1: number;
  rx: number;
  tx: number;
}

function readCpu() {
  const f = fs.readFileSync('/proc/stat', 'utf8').split('\n')[0].trim().split(/\s+/).slice(1).map(Number);
  return { idle: f[3] + (f[4] ?? 0), total: f.reduce((a, b) => a + b, 0) };
}

function readMem() {
  const m: Record<string, number> = {};
  for (const line of fs.readFileSync('/proc/meminfo', 'utf8').split('\n')) {
    const [k, v] = line.split(':');
    if (v) m[k] = parseInt(v, 10) * 1024;
  }
  return { total: m.MemTotal, used: m.MemTotal - m.MemAvailable };
}

let netScope: 'host' | 'container' = 'container';
function readNet() {
  let text: string;
  try {
    text = fs.readFileSync(`${HOST_PROC}/1/net/dev`, 'utf8'); // host network namespace, if /proc is mounted and readable
    netScope = 'host';
  } catch {
    text = fs.readFileSync('/proc/net/dev', 'utf8'); // this container's namespace only
    netScope = 'container';
  }
  let rx = 0;
  let tx = 0;
  for (const line of text.split('\n').slice(2)) {
    const [name, rest] = line.split(':');
    if (!rest) continue;
    const iface = name.trim();
    if (iface === 'lo' || /^(veth|br-|docker)/.test(iface)) continue;
    const f = rest.trim().split(/\s+/).map(Number);
    rx += f[0];
    tx += f[8];
  }
  return { rx, tx };
}

function readDisk() {
  const s = fs.statfsSync(HOST_ROOT);
  return { total: s.blocks * s.bsize, used: (s.blocks - s.bfree) * s.bsize };
}

export function hostInfo() {
  return {
    hostname: process.env.HOST_NAME ?? os.hostname(),
    cores: os.cpus().length,
    uptime: parseFloat(fs.readFileSync('/proc/uptime', 'utf8')),
    netScope,
  };
}

let prev: { t: number; cpu: ReturnType<typeof readCpu>; net: ReturnType<typeof readNet> } | null = null;

export function sample(): Sample | null {
  const t = Date.now();
  const cpu = readCpu();
  const net = readNet();
  const last = prev;
  prev = { t, cpu, net };
  if (!last) return null; // rates need two readings

  const dt = (t - last.t) / 1000;
  const dTotal = cpu.total - last.cpu.total;
  const mem = readMem();
  const disk = readDisk();
  const s: Sample = {
    ts: Math.floor(t / 1000),
    cpu: dTotal > 0 ? (1 - (cpu.idle - last.cpu.idle) / dTotal) * 100 : 0,
    mem_used: mem.used,
    mem_total: mem.total,
    disk_used: disk.used,
    disk_total: disk.total,
    load1: os.loadavg()[0],
    rx: Math.max(0, (net.rx - last.net.rx) / dt), // counters reset on reboot
    tx: Math.max(0, (net.tx - last.net.tx) / dt),
  };
  db.prepare(
    'INSERT OR REPLACE INTO samples (ts, cpu, mem_used, mem_total, disk_used, disk_total, load1, rx, tx) VALUES (?,?,?,?,?,?,?,?,?)',
  ).run(s.ts, s.cpu, s.mem_used, s.mem_total, s.disk_used, s.disk_total, s.load1, s.rx, s.tx);
  return s;
}

export function startCollector() {
  sample();
  setInterval(() => {
    try {
      sample();
    } catch (e) {
      console.error('sample failed', e);
    }
  }, INTERVAL_MS).unref();
}

export function latestSample(): Sample | undefined {
  return db.prepare('SELECT * FROM samples ORDER BY ts DESC LIMIT 1').get() as Sample | undefined;
}

export const RANGES: Record<string, number> = { '1h': 3600, '24h': 86400, '7d': 7 * 86400, '30d': 30 * 86400 };

export function series(range: string) {
  const span = RANGES[range] ?? RANGES['24h'];
  const bucket = Math.max(INTERVAL_MS / 1000, Math.round(span / 60));
  const since = Math.floor(Date.now() / 1000) - span;
  return db
    .prepare(
      `SELECT (ts / ?) * ? AS ts, AVG(cpu) AS cpu, AVG(mem_used) AS mem_used, MAX(mem_total) AS mem_total,
              AVG(load1) AS load1, AVG(rx) AS rx, AVG(tx) AS tx
       FROM samples WHERE ts >= ? GROUP BY ts / ? ORDER BY ts`,
    )
    .all(bucket, bucket, since, bucket);
}
