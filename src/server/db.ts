import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const file = process.env.DB_PATH ?? './data/dashboard.db';
fs.mkdirSync(path.dirname(file), { recursive: true });

export const db = new DatabaseSync(file);
db.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT);

  CREATE TABLE IF NOT EXISTS samples (
    ts INTEGER PRIMARY KEY,          -- unix seconds
    cpu REAL, mem_used REAL, mem_total REAL,
    disk_used REAL, disk_total REAL,
    load1 REAL, rx REAL, tx REAL     -- rx/tx in bytes per second
  );
  CREATE TABLE IF NOT EXISTS checks (
    ts INTEGER, app TEXT, ok INTEGER, code INTEGER, ms INTEGER
  );
  CREATE INDEX IF NOT EXISTS checks_app_ts ON checks (app, ts);

  -- One row per outage: opened by the first failed check, closed (end) by the next successful one. Kept forever.
  CREATE TABLE IF NOT EXISTS incidents (
    id INTEGER PRIMARY KEY, app TEXT, start INTEGER, end INTEGER, code INTEGER, checks INTEGER
  );
  CREATE INDEX IF NOT EXISTS incidents_app_start ON incidents (app, start);

  -- SSH events from the host journal. kind: 'login' (accepted) or 'failed'.
  CREATE TABLE IF NOT EXISTS ssh_events (
    ts INTEGER, kind TEXT, user TEXT, ip TEXT, port INTEGER, method TEXT, key_type TEXT, fingerprint TEXT,
    cursor TEXT UNIQUE
  );
  CREATE INDEX IF NOT EXISTS ssh_events_kind_ts ON ssh_events (kind, ts);

  -- Deploys, kept forever. source: 'containers' (compose project recreated) or 'release' (static site release folder).
  CREATE TABLE IF NOT EXISTS deploys (
    id INTEGER PRIMARY KEY, app TEXT, ts INTEGER, source TEXT, ref TEXT, info TEXT,
    UNIQUE (app, source, ref)
  );
  CREATE INDEX IF NOT EXISTS deploys_ts ON deploys (ts);
`);

export const RETENTION_DAYS = 30;
const SSH_LOGIN_RETENTION_DAYS = 365;

export const now = () => Math.floor(Date.now() / 1000);

export function kvGet(k: string): string | undefined {
  return (db.prepare('SELECT v FROM kv WHERE k = ?').get(k) as { v: string } | undefined)?.v;
}
export function kvSet(k: string, v: string) {
  db.prepare('INSERT INTO kv (k, v) VALUES (?, ?) ON CONFLICT (k) DO UPDATE SET v = excluded.v').run(k, v);
}

export function prune() {
  const cutoff = now() - RETENTION_DAYS * 86400;
  db.prepare('DELETE FROM samples WHERE ts < ?').run(cutoff);
  db.prepare('DELETE FROM checks WHERE ts < ?').run(cutoff);
  db.prepare("DELETE FROM ssh_events WHERE kind = 'failed' AND ts < ?").run(cutoff);
  db.prepare("DELETE FROM ssh_events WHERE kind = 'login' AND ts < ?").run(now() - SSH_LOGIN_RETENTION_DAYS * 86400);
}
