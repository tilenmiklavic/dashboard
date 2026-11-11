import { useEffect, useState } from 'react';
import { Chip, Select, Sidebar } from './ds.ts';
import { usePoll, type Overview as OverviewData } from './api.ts';
import { Overview } from './pages/Overview.tsx';
import { Apps } from './pages/Apps.tsx';
import { Deploys } from './pages/Deploys.tsx';
import { Downtime } from './pages/Downtime.tsx';
import { Logs } from './pages/Logs.tsx';

const RANGES = [
  { value: '1h', label: 'Last hour' },
  { value: '24h', label: 'Last 24 hours' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
];

const PAGES = [
  { path: '/', label: 'Overview', icon: 'home' },
  { path: '/apps', label: 'Apps', icon: 'layers' },
  { path: '/downtime', label: 'Downtime', icon: 'activity' },
  { path: '/deploys', label: 'Deploys', icon: 'undo' },
  { path: '/logs', label: 'Logs', icon: 'list' },
];

function useRoute() {
  const read = () => (location.hash.replace(/^#/, '') || '/');
  const [route, setRoute] = useState(read);
  useEffect(() => {
    const on = () => setRoute(read());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}

export function App() {
  const route = useRoute();
  const [range, setRange] = useState('24h');
  const { data, error } = usePoll<OverviewData>('/api/overview');
  const page = PAGES.find((p) => p.path === route) ?? PAGES[0];

  return (
    <div className="shell">
      <div className="shell__side">
        <Sidebar
          brand={data?.host.hostname ?? 'Server dashboard'}
          items={PAGES.map((p) => ({ label: p.label, icon: p.icon, href: '#' + p.path, active: p.path === page.path }))}
        />
      </div>
      <main className="shell__main">
        <nav className="shell__tabs" aria-label="Pages">
          {PAGES.map((p) => (
            <a key={p.path} href={'#' + p.path}><Chip selected={p.path === page.path}>{p.label}</Chip></a>
          ))}
        </nav>
        <header className="shell__head">
          <h1 className="page-title">{page.label}</h1>
          {page.path === '/' && (
            <Select icon="calendar" options={RANGES} value={range} onChange={setRange} />
          )}
        </header>
        {error && !data && <p className="muted">Could not load data ({error}).</p>}
        {data && page.path === '/' && <Overview data={data} range={range} />}
        {data && page.path === '/apps' && <Apps data={data} />}
        {page.path === '/downtime' && <Downtime />}
        {page.path === '/deploys' && <Deploys />}
        {page.path === '/logs' && <Logs />}
      </main>
    </div>
  );
}
