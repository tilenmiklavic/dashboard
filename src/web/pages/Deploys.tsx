import { useState } from 'react';
import { Card, DataTable, Select, StatCard } from '../ds.ts';
import { usePoll } from '../api.ts';
import { ago, dateTime } from '../format.ts';

interface Deploy {
  id: number; app: string; ts: number; source: 'containers' | 'release'; ref: string; info: string;
  by: { ip: string; keyName: string | null } | null;
}

export function Deploys() {
  const { data, error } = usePoll<{ deploys: Deploy[] }>('/api/deploys', 30_000);
  const [app, setApp] = useState('all');
  if (!data) return <p className="muted">{error ? `Could not load deploys (${error}).` : 'Loading…'}</p>;

  const apps = [...new Set(data.deploys.map((d) => d.app))].sort();
  const latest = apps.map((a) => data.deploys.find((d) => d.app === a)!);
  const shown = app === 'all' ? data.deploys : data.deploys.filter((d) => d.app === app);

  return (
    <div className="stack">
      <div className="grid grid--stats">
        {latest.map((d) => (
          <StatCard key={d.app} label={d.app} value={ago(d.ts)} note={`Last deploy ${dateTime(d.ts)}`} />
        ))}
      </div>
      <Card
        title="Deploys"
        description="Detected when an app's containers are recreated or a static site gets a new release. Restarts are not counted."
        aside={<Select options={[{ value: 'all', label: 'All apps' }, ...apps.map((a) => ({ value: a, label: a }))]} value={app} onChange={setApp} />}
      >
        {shown.length ? (
          <DataTable
            columns={[
              { key: 'ts', label: 'Time' },
              { key: 'app', label: 'App' },
              { key: 'what', label: 'What changed' },
              { key: 'by', label: 'Deployed by' },
            ]}
            rows={shown.map((d) => ({
              ts: dateTime(d.ts),
              app: d.app,
              what: d.source === 'release' ? d.info : `Rebuilt ${d.info}`,
              by: d.by ? d.by.keyName ?? d.by.ip : '—',
            }))}
          />
        ) : (
          <p className="muted">No deploys recorded yet.</p>
        )}
      </Card>
    </div>
  );
}
