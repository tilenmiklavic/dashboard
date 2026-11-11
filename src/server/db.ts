import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const file = process.env.DB_PATH ?? './data/dashboard.db';
fs.mkdirSync(path.dirname(file), { recursive: true });

export const db = new DatabaseSync(file);
db.exec(`
  PRAGMA journal_mode = WAL;
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
`);

export const RETENTION_DAYS = 30;

export function prune() {
  const cutoff = Math.floor(Date.now() / 1000) - RETENTION_DAYS * 86400;
  db.prepare('DELETE FROM samples WHERE ts < ?').run(cutoff);
  db.prepare('DELETE FROM checks WHERE ts < ?').run(cutoff);
}
