import { Card, DataTable, StatCard } from '../ds.ts';
import { usePoll } from '../api.ts';
import { ago, dateTime } from '../format.ts';

interface Login { ts: number; user: string; ip: string; method: string; keyType: string | null; fingerprint: string | null; keyName: string | null }
interface Failed { ip: string; attempts: number; last: number; users: string[] }
interface SshData {
  source: { ok: boolean; detail: string };
  logins: Login[];
  logins24h: number;
  failed24h: number;
  failedIps24h: number;
  topFailed: Failed[];
}

const shortFp = (fp: string | null) => (fp ? fp.slice(0, 19) + '…' : '—');

export function Logs() {
  const { data, error } = usePoll<SshData>('/api/ssh', 30_000);
  if (!data) return <p className="muted">{error ? `Could not load SSH logs (${error}).` : 'Loading…'}</p>;
  const last = data.logins[0];

  return (
    <div className="stack">
      {!data.source.ok && <p className="muted">SSH log unavailable: {data.source.detail}</p>}
      <div className="grid grid--stats">
        <StatCard label="Logins (24h)" value={data.logins24h.toLocaleString('en-US')} note="Successful SSH sessions" />
        <StatCard label="Last login" value={last ? ago(last.ts) : '—'} note={last ? `${last.user} from ${last.ip}` : 'None recorded'} />
        <StatCard label="Failed attempts (24h)" value={data.failed24h.toLocaleString('en-US')} tone={data.failed24h ? 'warning' : 'neutral'} note="Rejected keys and unknown users" />
        <StatCard label="Attacking IPs (24h)" value={data.failedIps24h.toLocaleString('en-US')} note="Distinct sources of failed attempts" />
      </div>
      <Card title="SSH logins" description="Successful logins, newest first. Key names come from the authorized_keys comments on the server.">
        {data.logins.length ? (
          <DataTable
            columns={[
              { key: 'ts', label: 'Time' },
              { key: 'user', label: 'User' },
              { key: 'ip', label: 'IP address', mono: true },
              { key: 'key', label: 'Key' },
            ]}
            rows={data.logins.map((l) => ({
              ts: dateTime(l.ts),
              user: l.user,
              ip: l.ip,
              key: l.keyName ?? (l.method === 'publickey' ? `${l.keyType ?? ''} ${shortFp(l.fingerprint)}` : l.method),
            }))}
          />
        ) : (
          <p className="muted">No logins recorded yet.</p>
        )}
      </Card>
      <Card title="Failed attempts by IP" description="Last 7 days, most persistent first.">
        {data.topFailed.length ? (
          <DataTable
            columns={[
              { key: 'ip', label: 'IP address', mono: true },
              { key: 'attempts', label: 'Attempts', mono: true, align: 'right' },
              { key: 'last', label: 'Last seen' },
              { key: 'users', label: 'Usernames tried' },
            ]}
            rows={data.topFailed.map((f) => ({
              ip: f.ip,
              attempts: f.attempts.toLocaleString('en-US'),
              last: dateTime(f.last),
              users: f.users.slice(0, 5).join(', ') + (f.users.length > 5 ? ` +${f.users.length - 5}` : ''),
            }))}
          />
        ) : (
          <p className="muted">No failed attempts in the last 7 days.</p>
        )}
      </Card>
    </div>
  );
}
