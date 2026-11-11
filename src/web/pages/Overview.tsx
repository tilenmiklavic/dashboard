import { Card, DataTable, Gauge, Legend, LineChart, StatCard, Status } from '../ds.ts';
import { usePoll, type Overview as OverviewData, type Point } from '../api.ts';
import { bytes, duration, ms, pct, rate, timeLabel } from '../format.ts';

const SPAN: Record<string, number> = { '1h': 3600, '24h': 86400, '7d': 7 * 86400, '30d': 30 * 86400 };

function xLabels(points: Point[], span: number) {
  if (points.length < 2) return undefined;
  const n = 5;
  return Array.from({ length: n }, (_, i) => timeLabel(points[Math.round((i / (n - 1)) * (points.length - 1))].ts, span));
}

const tone = (v: number, warn: number, bad: number) => (v >= bad ? 'negative' : v >= warn ? 'warning' : 'neutral');

export function Overview({ data, range }: { data: OverviewData; range: string }) {
  const { data: m } = usePoll<{ points: Point[] }>(`/api/metrics?range=${range}`, 30_000);
  const now = data.now;
  const points = m?.points ?? [];
  const span = SPAN[range];
  const labels = xLabels(points, span);
  const enough = points.length >= 2;

  const memPct = now ? (now.mem_used / now.mem_total) * 100 : 0;
  const diskPct = now ? (now.disk_used / now.disk_total) * 100 : 0;
  const peakNet = Math.max(1, ...points.flatMap((p) => [p.rx, p.tx]));

  return (
    <div className="stack">
      <div className="grid grid--stats">
        <StatCard label="CPU" value={now ? pct(now.cpu, 1) : '—'} tone={tone(now?.cpu ?? 0, 70, 90)} note={`${data.host.cores} cores · load ${now ? now.load1.toFixed(2) : '—'}`} />
        <StatCard label="Memory" value={now ? pct(memPct) : '—'} tone={tone(memPct, 80, 92)} note={now ? `${bytes(now.mem_used)} of ${bytes(now.mem_total)}` : undefined} />
        <StatCard label="Disk" value={now ? pct(diskPct) : '—'} tone={tone(diskPct, 80, 92)} note={now ? `${bytes(now.disk_used)} of ${bytes(now.disk_total)}` : undefined} />
        <StatCard label="Network" value={now ? rate(now.rx + now.tx) : '—'} note={now ? `In ${rate(now.rx)} · out ${rate(now.tx)}` : undefined} />
        <StatCard label="Uptime" value={duration(data.host.uptime)} note={`${data.apps.filter((a) => a.status === 'healthy').length} of ${data.apps.length} apps healthy`} />
      </div>

      <div className="grid grid--charts">
        <Card
          title="CPU load"
          description={points.length ? `Average ${pct(points.reduce((a, p) => a + p.cpu, 0) / points.length, 1)} over the period` : 'Collecting data…'}
        >
          {enough ? (
            <LineChart height={160} min={0} max={100} yTicks={['0', '25', '50', '75', '100']} labels={labels} series={[{ tone: 'accent', data: points.map((p) => p.cpu) }]} />
          ) : (
            <p className="muted">Needs a few minutes of samples.</p>
          )}
        </Card>
        <Card
          title="Network throughput"
          description={data.host.netScope === 'host' ? 'Host interfaces, bytes per second' : 'This container only; mount the host /proc for host totals'}
          aside={<Legend items={[{ label: 'In', color: 'var(--accent)' }, { label: 'Out', color: 'var(--chart-muted)' }]} />}
        >
          {enough ? (
            <LineChart
              height={160}
              min={0}
              max={peakNet}
              yTicks={[rate(0), rate(peakNet / 2), rate(peakNet)]}
              labels={labels}
              series={[{ tone: 'accent', data: points.map((p) => p.rx) }, { tone: 'muted', data: points.map((p) => p.tx) }]}
            />
          ) : (
            <p className="muted">Needs a few minutes of samples.</p>
          )}
        </Card>
      </div>

      <div className="grid grid--charts">
        <Card title="Apps">
          <DataTable
            columns={[
              { key: 'app', label: 'App' },
              { key: 'status', label: 'Status' },
              { key: 'ms', label: 'Response', mono: true, align: 'right' },
              { key: 'up', label: 'Uptime 24h', mono: true, align: 'right' },
            ]}
            rows={data.apps.map((a) => ({
              app: a.name,
              status: <Status status={a.status} />,
              ms: ms(a.ms),
              up: a.uptime24h == null ? '—' : pct(a.uptime24h * 100, 2),
            }))}
          />
        </Card>
        <div className="grid grid--pair">
          <Card title="Memory">
            <Gauge value={memPct} max={100} display={pct(memPct)} caption={now ? `${bytes(now.mem_used)} in use` : ''} />
          </Card>
          <Card title="Disk">
            <Gauge value={diskPct} max={100} display={pct(diskPct)} caption={now ? `${bytes(now.disk_total - now.disk_used)} free` : ''} />
          </Card>
        </div>
      </div>
    </div>
  );
}
