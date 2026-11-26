import { Card, DataTable, LineChart, Status } from '../ds.ts';
import { usePoll, type AppInfo, type AppTraffic, type Overview, type TrafficData } from '../api.ts';
import { bytes, count, ms, pct, timeLabel } from '../format.ts';

const containerStatus = (state: string) => (state === 'running' ? 'healthy' : state === 'restarting' ? 'degraded' : state === 'exited' || state === 'dead' ? 'down' : 'idle');

function Traffic({ t, source }: { t: AppTraffic | undefined; source: TrafficData['source'] | undefined }) {
  if (!source) return null;
  if (!source.ok) return <p className="muted">Traffic unavailable: {source.detail}</p>;
  if (!t || !t.requests) return <p className="muted">Traffic (24h): no requests recorded yet.</p>;
  const errRate = (t.errors5xx / t.requests) * 100;
  const labels = [0, 15, 30, 45, 59].map((i) => timeLabel(t.series[i].ts, 86400));
  return (
    <div className="stack stack--tight">
      <p className="muted">
        Traffic (24h): <strong>{count(t.requests)}</strong> requests · {bytes(t.bytes)} sent · avg {ms(t.avgMs)} ·{' '}
        server errors {pct(errRate, errRate && errRate < 1 ? 2 : 0)} ({count(t.errors5xx)}) · 4xx {count(t.errors4xx)}
      </p>
      <LineChart height={80} min={0} labels={labels} series={[{ tone: 'accent', data: t.series.map((p) => p.req) }]} />
    </div>
  );
}

function AppCard({ app, dockerAvailable, traffic, source }: { app: AppInfo; dockerAvailable: boolean; traffic?: AppTraffic; source?: TrafficData['source'] }) {
  return (
    <Card
      title={app.name}
      description={app.url.replace(/^https?:\/\//, '')}
      aside={
        <div className="sd-figure">
          <Status status={app.status} />
          <div className="sd-figure__row"><span className="metric-lg">{ms(app.ms)}</span></div>
        </div>
      }
    >
      <div className="stack stack--tight">
        <p className="muted">
          Uptime 24h {app.uptime24h == null ? '—' : pct(app.uptime24h * 100, 2)} · avg {ms(app.avgMs24h)} ·{' '}
          <a href={app.url} target="_blank" rel="noreferrer">Open</a>
        </p>
        <Traffic t={traffic} source={source} />
        {app.history.length >= 2 && (
          <>
            <p className="muted">Response time of the health check, last 3 hours</p>
            <LineChart height={60} series={[{ tone: 'muted', data: app.history }]} />
          </>
        )}
        {dockerAvailable ? (
          app.containers.length ? (
            <DataTable
              columns={[
                { key: 'name', label: 'Container' },
                { key: 'state', label: 'State' },
                { key: 'status', label: 'Detail' },
              ]}
              rows={app.containers.map((c) => ({ name: c.name, state: <Status status={containerStatus(c.state)}>{c.state}</Status>, status: c.status }))}
            />
          ) : (
            <p className="muted">No containers found for compose project “{app.name}”.</p>
          )
        ) : (
          <p className="muted">Docker socket not available, container details are hidden.</p>
        )}
      </div>
    </Card>
  );
}

export function Apps({ data }: { data: Overview }) {
  const { data: traffic } = usePoll<TrafficData>('/api/traffic?range=24h', 60_000);
  return (
    <div className="grid grid--charts">
      {data.apps.map((a) => (
        <AppCard
          key={a.name}
          app={a}
          dockerAvailable={data.dockerAvailable}
          traffic={traffic?.apps.find((t) => t.name === a.name)}
          source={traffic?.source}
        />
      ))}
    </div>
  );
}
