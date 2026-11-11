// Number formatting per the design system README: thousands separators, units after a space, an em dash for no data.
const DASH = '—';

export function bytes(n: number | null | undefined): string {
  if (n == null || !isFinite(n)) return DASH;
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  while (n >= 1000 && i < units.length - 1) {
    n /= 1000;
    i++;
  }
  return `${n >= 100 || i === 0 ? Math.round(n) : n.toFixed(n >= 10 ? 1 : 2)} ${units[i]}`;
}

export const rate = (n: number | null | undefined) => (n == null ? DASH : `${bytes(n)}/s`);
export const pct = (n: number | null | undefined, digits = 0) => (n == null ? DASH : `${n.toFixed(digits)}%`);
export const ms = (n: number | null | undefined) => (n == null ? DASH : `${n.toLocaleString('en-US')} ms`);

export function duration(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return d ? `${d}d ${h}h` : h ? `${h}h ${m}m` : `${m}m`;
}

export function timeLabel(ts: number, spanSeconds: number): string {
  const d = new Date(ts * 1000);
  return spanSeconds <= 86400
    ? d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export function dateTime(ts: number | null | undefined): string {
  if (ts == null) return '—';
  return new Date(ts * 1000).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

/** Like duration(), but down to seconds for short outages. */
export function span(seconds: number): string {
  return seconds < 60 ? `${Math.max(0, Math.round(seconds))}s` : duration(seconds);
}

export function ago(ts: number | null | undefined): string {
  if (ts == null) return '—';
  const s = Date.now() / 1000 - ts;
  return s < 60 ? 'just now' : `${span(s)} ago`;
}
