import { Card, DataTable, StatCard, Status } from '../ds.ts';
import { usePoll } from '../api.ts';
import { dateTime, span } from '../format.ts';

interface Incident { id: number; app: string; start: number; end: number | null; code: number; checks: number }
interface Summary { app: string; incidents30d: number; downtime30d: number; ongoing: boolean }

const reason = (code: number) => (code ? `HTTP ${code}` : 'No response');

export function Downtime() {
  const { data, error } = usePoll<{ incidents: Incident[]; summary: Summary[] }>('/api/downtime', 30_000);
  if (!data) return <p className="muted">{error ? `Could not load downtime (${error}).` : 'Loading…'}</p>;
  const nowS = Date.now() / 1000;

  return (
    <div className="stack">
      <div className="grid grid--stats">
        {data.summary.map((s) => (
          <StatCard
            key={s.app}
            label={s.app}
            value={s.downtime30d ? span(s.downtime30d) : 'None'}
            tone={s.ongoing ? 'negative' : s.incidents30d ? 'warning' : 'neutral'}
            note={`${s.ongoing ? 'Down right now · ' : ''}${s.incidents30d} ${s.incidents30d === 1 ? 'outage' : 'outages'} in 30 days`}
          />
        ))}
      </div>
      <Card title="Outages" description="Each row is a period when an app's health check failed. Checks run every minute, so times are accurate to about a minute.">
        {data.incidents.length ? (
          <DataTable
            columns={[
              { key: 'app', label: 'App' },
              { key: 'status', label: 'Status' },
              { key: 'start', label: 'Down since' },
              { key: 'end', label: 'Back at' },
              { key: 'duration', label: 'Duration', mono: true, align: 'right' },
              { key: 'reason', label: 'Reason' },
            ]}
            rows={data.incidents.map((i) => ({
              app: i.app,
              status: i.end == null ? <Status status="down">Ongoing</Status> : <Status status="idle">Resolved</Status>,
              start: dateTime(i.start),
              end: i.end == null ? '—' : dateTime(i.end),
              duration: span((i.end ?? nowS) - i.start),
              reason: reason(i.code),
            }))}
          />
        ) : (
          <p className="muted">No outages recorded. Every health check has passed so far.</p>
        )}
      </Card>
    </div>
  );
}
