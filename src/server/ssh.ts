import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { db, kvGet, kvSet, now } from './db.ts';

// Reads sshd's messages from the host's systemd journal (Debian 13 has no auth.log by default) through the read-only
// host root mount, with the container's own journalctl. Incremental: the last journal cursor is kept in kv.
const HOST_ROOT = process.env.HOST_ROOT ?? '/';
const POLL_MS = 60_000;

export const sshSource = { ok: false, detail: 'Not read yet', dir: '' };

function journalDir(): string | null {
  const candidates = [process.env.JOURNAL_DIR, path.join(HOST_ROOT, 'var/log/journal'), path.join(HOST_ROOT, 'run/log/journal')];
  for (const d of candidates) {
    if (d && fs.existsSync(d) && fs.readdirSync(d).length) return d;
  }
  return null;
}

// Messages as OpenSSH logs them (sshd / sshd-session), e.g.
//   Accepted publickey for dashboard from 203.0.113.7 port 51022 ssh2: ED25519 SHA256:abc…
//   Invalid user admin from 198.51.100.4 port 40112
//   Failed password for root from 198.51.100.4 port 40112 ssh2
//   Connection closed by authenticating user root 198.51.100.4 port 40112 [preauth]
const ACCEPTED = /^Accepted (\S+) for (\S+) from (\S+) port (\d+) ssh2(?:: (\S+) (SHA256:\S+))?/;
const INVALID = /^Invalid user (\S*) from (\S+) port (\d+)/;
const FAILED = /^Failed (\S+) for (?!invalid user )(\S+) from (\S+) port (\d+)/;
const CLOSED_PREAUTH = /^(?:Connection closed by|Disconnected from) authenticating user (\S+) (\S+) port (\d+) \[preauth\]/;

export interface SshEvent {
  ts: number;
  kind: 'login' | 'failed';
  user: string;
  ip: string;
  port: number;
  method: string | null;
  keyType: string | null;
  fingerprint: string | null;
}

/** Parses one sshd message; null when it is not a login or a failed attempt. */
export function parseSshMessage(msg: string, ts: number): SshEvent | null {
  let m = ACCEPTED.exec(msg);
  if (m) return { ts, kind: 'login', method: m[1], user: m[2], ip: m[3], port: +m[4], keyType: m[5] ?? null, fingerprint: m[6] ?? null };
  if ((m = INVALID.exec(msg))) return { ts, kind: 'failed', method: 'invalid user', user: m[1], ip: m[2], port: +m[3], keyType: null, fingerprint: null };
  if ((m = FAILED.exec(msg))) return { ts, kind: 'failed', method: m[1], user: m[2], ip: m[3], port: +m[4], keyType: null, fingerprint: null };
  if ((m = CLOSED_PREAUTH.exec(msg))) return { ts, kind: 'failed', method: 'rejected', user: m[1], ip: m[2], port: +m[3], keyType: null, fingerprint: null };
  return null;
}

// One connection can log several failure lines (e.g. "Invalid user" then "Disconnected from invalid user"); count it once.
const recentFailures = new Map<string, number>();
function isDuplicateFailure(e: SshEvent) {
  const key = `${e.ip}:${e.port}`;
  for (const [k, t] of recentFailures) if (e.ts - t > 600) recentFailures.delete(k);
  if (recentFailures.has(key)) return true;
  recentFailures.set(key, e.ts);
  return false;
}

let running = false;
export async function pollSsh(): Promise<void> {
  if (running) return;
  const dir = journalDir();
  if (!dir) {
    Object.assign(sshSource, { ok: false, detail: 'No systemd journal found on the host (/var/log/journal).', dir: '' });
    return;
  }
  running = true;
  const cursor = kvGet('ssh_cursor');
  const args = ['-D', dir, '-o', 'json', '--no-pager', '-q'];
  args.push(...(cursor ? ['--after-cursor', cursor] : ['--since', '30 days ago']));
  // Match sshd however it is run: the ssh.service unit, or by syslog identifier (OpenSSH 9.8+ logs as sshd-session).
  args.push('_SYSTEMD_UNIT=ssh.service', '+', 'SYSLOG_IDENTIFIER=sshd', '+', 'SYSLOG_IDENTIFIER=sshd-session');

  const insert = db.prepare(
    'INSERT OR IGNORE INTO ssh_events (ts, kind, user, ip, port, method, key_type, fingerprint, cursor) VALUES (?,?,?,?,?,?,?,?,?)',
  );
  let last: string | undefined;
  let stderr = '';
  try {
    await new Promise<void>((resolve, reject) => {
      const p = spawn('journalctl', args, { stdio: ['ignore', 'pipe', 'pipe'] });
      p.on('error', reject);
      p.stderr.on('data', (d) => (stderr += d));
      const rl = readline.createInterface({ input: p.stdout });
      db.exec('BEGIN');
      rl.on('line', (line) => {
        let j: Record<string, unknown>;
        try {
          j = JSON.parse(line);
        } catch {
          return;
        }
        last = String(j.__CURSOR);
        if (typeof j.MESSAGE !== 'string') return;
        const e = parseSshMessage(j.MESSAGE, Math.floor(Number(j.__REALTIME_TIMESTAMP) / 1e6));
        if (!e || (e.kind === 'failed' && isDuplicateFailure(e))) return;
        insert.run(e.ts, e.kind, e.user, e.ip, e.port, e.method, e.keyType, e.fingerprint, last);
      });
      p.on('close', (code) => {
        db.exec('COMMIT');
        code === 0 ? resolve() : reject(new Error(`journalctl exited ${code}: ${stderr.trim().slice(0, 300)}`));
      });
    });
    if (last) kvSet('ssh_cursor', last);
    Object.assign(sshSource, { ok: true, detail: 'Reading sshd messages from the host journal.', dir });
  } catch (e) {
    Object.assign(sshSource, { ok: false, detail: String((e as Error).message), dir });
  } finally {
    running = false;
  }
}

export function startSsh() {
  pollSsh();
  setInterval(pollSsh, POLL_MS).unref();
}

// --- Key names ---------------------------------------------------------------------------------------------------------
// Maps "SHA256:…" fingerprints to the comment of the matching authorized_keys line, so a login shows
// "github-actions dashboard" instead of a hash.
const KEY_TYPE = /^(ssh-|ecdsa-|sk-)/;

export function fingerprintOf(blobBase64: string) {
  return 'SHA256:' + crypto.createHash('sha256').update(Buffer.from(blobBase64, 'base64')).digest('base64').replace(/=+$/, '');
}

export function keyNames(): Map<string, string> {
  const files = [path.join(HOST_ROOT, 'root/.ssh/authorized_keys')];
  try {
    for (const u of fs.readdirSync(path.join(HOST_ROOT, 'home'))) files.push(path.join(HOST_ROOT, 'home', u, '.ssh/authorized_keys'));
  } catch {
    /* no /home */
  }
  const names = new Map<string, string>();
  for (const f of files) {
    let text: string;
    try {
      text = fs.readFileSync(f, 'utf8');
    } catch {
      continue;
    }
    for (const line of text.split('\n')) {
      const parts = line.trim().split(/\s+/);
      const i = parts.findIndex((p) => KEY_TYPE.test(p));
      if (i < 0 || !parts[i + 1]) continue;
      const comment = parts.slice(i + 2).join(' ');
      if (comment) names.set(fingerprintOf(parts[i + 1]), comment);
    }
  }
  return names;
}
