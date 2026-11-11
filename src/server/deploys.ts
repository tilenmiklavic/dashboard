import fs from 'node:fs';
import path from 'node:path';
import { containers } from './apps.ts';
import { db } from './db.ts';

// Detects deploys two ways:
//  - containers: a compose project gets containers with new IDs (deploy.sh's `docker compose up --build` recreates them);
//  - release: a static site gets a new /opt/<app>/releases/<YYYYMMDD-HHMMSS> folder (the static deploy.sh template).
// Restarts keep a container's ID, so they are not counted.
const HOST_ROOT = process.env.HOST_ROOT ?? '/';
const POLL_MS = 60_000;
const GROUP_WINDOW = 300; // containers created within 5 minutes of each other belong to one deploy

const known = new Map<string, Set<string>>();

function recordContainers(app: string, ts: number, ids: string[], services: string[]) {
  const ref = ids.map((id) => id.slice(0, 12)).sort().join(',');
  const info = [...new Set(services)].sort().join(', ');
  const near = db
    .prepare("SELECT id, ref, info FROM deploys WHERE app = ? AND source = 'containers' AND ABS(ts - ?) <= ? ORDER BY ts DESC LIMIT 1")
    .get(app, ts, GROUP_WINDOW) as { id: number; ref: string; info: string } | undefined;
  if (near) {
    if (near.ref.split(',').includes(ref.split(',')[0])) return; // already recorded (e.g. after a dashboard restart)
    const merged = (s: string, t: string, sep: string) => [...new Set([...s.split(sep), ...t.split(sep)])].filter(Boolean).sort().join(sep);
    db.prepare('UPDATE deploys SET ts = MAX(ts, ?), ref = ?, info = ? WHERE id = ?').run(ts, merged(near.ref, ref, ','), merged(near.info, info, ', '), near.id);
  } else {
    db.prepare("INSERT OR IGNORE INTO deploys (app, ts, source, ref, info) VALUES (?, ?, 'containers', ?, ?)").run(app, ts, ref, info);
  }
}

const RELEASE = /^(\d{4})(\d{2})(\d{2})-(\d{2})(\d{2})(\d{2})$/;

function scanReleases(app: string) {
  let names: string[];
  try {
    names = fs.readdirSync(path.join(HOST_ROOT, 'opt', app, 'releases'));
  } catch {
    return;
  }
  const insert = db.prepare("INSERT OR IGNORE INTO deploys (app, ts, source, ref, info) VALUES (?, ?, 'release', ?, ?)");
  for (const n of names) {
    const m = RELEASE.exec(n);
    if (!m) continue;
    const ts = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]) / 1000;
    insert.run(app, ts, n, `release ${n}`);
  }
}

export async function pollDeploys() {
  const { available, list } = await containers();
  if (!available) return;
  const byProject = new Map<string, typeof list>();
  for (const c of list) {
    if (!c.project) continue;
    byProject.set(c.project, [...(byProject.get(c.project) ?? []), c]);
  }
  for (const [project, cs] of byProject) {
    const prev = known.get(project);
    const fresh = prev ? cs.filter((c) => !prev.has(c.id)) : cs;
    if (fresh.length) {
      // On the first poll, only the newest group of containers counts as the last deploy.
      const newest = Math.max(...fresh.map((c) => c.created));
      const group = fresh.filter((c) => newest - c.created <= GROUP_WINDOW);
      recordContainers(project, newest, group.map((c) => c.id), group.map((c) => c.service || c.name));
    }
    known.set(project, new Set(cs.map((c) => c.id)));
    scanReleases(project);
  }
}

export function startDeploys() {
  pollDeploys();
  setInterval(pollDeploys, POLL_MS).unref();
}
