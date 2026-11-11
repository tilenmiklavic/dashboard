import { Card, DataTable, LineChart, Status } from '../ds.ts';
import type { AppInfo, Overview } from '../api.ts';
import { ms, pct } from '../format.ts';

const containerStatus = (state: string) => (state === 'running' ? 'healthy' : state === 'restarting' ? 'degraded' : state === 'exited' || state === 'dead' ? 'down' : 'idle');

function AppCard({ app, dockerAvailable }: { app: AppInfo; dockerAvailable: boolean }) {
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
        {app.history.length >= 2 && <LineChart height={80} series={[{ tone: 'accent', data: app.history }]} />}
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
  return (
    <div className="grid grid--charts">
      {data.apps.map((a) => <AppCard key={a.name} app={a} dockerAvailable={data.dockerAvailable} />)}
    </div>
  );
}
