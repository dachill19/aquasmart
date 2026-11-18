import { useMemo, type CSSProperties, type ReactNode } from "react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { OFFLINE_AFTER_MS, useAnalytics, type Analytics, type AnalyticsRange, type DeviceAnalytics } from "../lib/api";
import { formatDayClock, formatNumber, formatShortClock } from "../lib/format";
import { CardHead, Tag } from "./ui";

// shortcut: only three identity colours are validated, so a fourth aquarium reuses slot 1; validate a fourth slot before adding one.
const seriesColor = (id: number) => `var(--series-${((id - 1) % 3) + 1})`;

const AXIS = { fill: "var(--muted)", fontSize: 11, fontFamily: "var(--font-mono)" } as const;

const RANGE_LABEL: Record<AnalyticsRange, string> = { "1h": "1 jam", "24h": "24 jam", "7d": "7 hari" };

type Props = { range: AnalyticsRange; onRange: (r: AnalyticsRange) => void; now: number };

/** Every aquarium side by side over one window: the scalability view. */
export function AnalyticsPage({ range, onRange, now }: Props) {
  const { data, error } = useAnalytics(range);

  return (
    <>
      <section className="rise flex flex-col gap-4 pb-1 pt-7 lg:flex-row lg:items-end lg:justify-between" style={{ "--i": 0 } as CSSProperties}>
        <div>
          <h1 className="text-[clamp(1.7rem,3vw,2.4rem)] font-semibold leading-[1.1] tracking-[-0.03em]">Analitik semua akuarium</h1>
          <p className="mt-2 max-w-[62ch] text-[0.92rem] leading-relaxed text-muted">
            Setiap akuarium dibandingkan pada rentang yang sama. Semua angka dihitung server dari data yang dilaporkan alat.
          </p>
        </div>
        <div className="flex gap-1 rounded-[0.7rem] border border-line-strong p-1" role="group" aria-label="Rentang waktu">
          {(Object.keys(RANGE_LABEL) as AnalyticsRange[]).map((r) => (
            <button
              key={r}
              type="button"
              aria-pressed={r === range}
              onClick={() => onRange(r)}
              className="rounded-[0.5rem] px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:text-fg aria-pressed:bg-raised aria-pressed:text-fg"
            >
              {RANGE_LABEL[r]}
            </button>
          ))}
        </div>
      </section>

      {error && (
        <p role="alert" className="mt-4 rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm">
          <strong className="font-semibold text-danger">Gagal memuat analitik:</strong> <span className="text-muted">{error}</span>
        </p>
      )}

      {!data ? (
        <div className="mt-5 grid gap-4">
          <div className="skeleton h-24" />
          <div className="skeleton h-80" />
        </div>
      ) : (
        <>
          <Summary data={data} now={now} />
          <div className="mt-4 grid gap-4 xl:grid-cols-2">
            <FleetChart data={data} metric="level_air" title="Ketinggian air semua akuarium" />
            {/* Feed stock moves in steps of about 20%, so its lines are drawn as steps. */}
            <FleetChart data={data} metric="stok_pakan" title="Stok pakan semua akuarium" />
          </div>
          <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
            <ComparisonTable data={data} now={now} />
            <AlertsChart data={data} />
          </div>
        </>
      )}
    </>
  );
}

function online(d: DeviceAnalytics, now: number) {
  return d.last_ts !== null && now - d.last_ts <= OFFLINE_AFTER_MS;
}

function Cell({ label, children, sub }: { label: string; children: ReactNode; sub: ReactNode }) {
  return (
    <div className="px-5 py-4">
      <p className="label">{label}</p>
      <p className="tnum mt-2 text-[1.05rem] font-semibold leading-none">{children}</p>
      <p className="mt-2 text-xs text-muted">{sub}</p>
    </div>
  );
}

function Summary({ data, now }: { data: Analytics; now: number }) {
  const devices = data.devices;
  const live = devices.filter((d) => online(d, now)).length;
  const withLevel = devices.filter((d) => d.avg_level !== null);
  const avgLevel = withLevel.length ? withLevel.reduce((s, d) => s + d.avg_level!, 0) / withLevel.length : null;
  const water = devices.reduce((s, d) => s + d.alerts.critical_water, 0);
  const food = devices.reduce((s, d) => s + d.alerts.critical_food, 0);
  const cmd = devices.reduce(
    (s, d) => ({ total: s.total + d.commands.total, acked: s.acked + d.commands.acked, expired: s.expired + d.commands.expired }),
    { total: 0, acked: 0, expired: 0 }
  );
  const responses = devices.filter((d) => d.avg_response_ms !== null);
  const avgResponse = responses.length ? responses.reduce((s, d) => s + d.avg_response_ms!, 0) / responses.length : null;

  return (
    <section
      className="card rise mt-5 grid grid-cols-2 divide-line max-xl:[&>*:nth-child(n+3)]:border-t max-xl:[&>*:nth-child(n+3)]:border-line xl:grid-cols-4 xl:divide-x"
      style={{ "--i": 1 } as CSSProperties}
      aria-label="Ringkasan armada"
    >
      <Cell label="Akuarium online" sub="melapor dalam 60 detik terakhir">
        {live} / {devices.length}
      </Cell>
      <Cell label="Rata-rata ketinggian air" sub={`rata-rata tiap akuarium, ${RANGE_LABEL[data.range]} terakhir`}>
        {avgLevel === null ? "—" : `${formatNumber(avgLevel)}%`}
      </Cell>
      <Cell label="Peringatan" sub={`air kritis ${water} · pakan menipis ${food}`}>
        {water + food}
      </Cell>
      <Cell
        label="Perintah disahkan alat"
        sub={`${cmd.expired} kedaluwarsa · respon rata-rata ${avgResponse === null ? "—" : `${formatNumber(avgResponse / 1000, 1)} dtk`}`}
      >
        {cmd.acked} / {cmd.total}
      </Cell>
    </section>
  );
}

type Row = { ts: number } & Record<string, number | null>;

function FleetChart({ data, metric, title }: { data: Analytics; metric: "level_air" | "stok_pakan"; title: string }) {
  const { rows, lastIndex } = useMemo(() => {
    // One row per time slot across the whole window, empty where nothing was reported,
    // so a period without data shows as a break instead of a line drawn across it.
    const byTs = new Map<number, Row>();
    const first = Math.floor(data.since / data.bucket_ms) * data.bucket_ms;
    for (let ts = first; ts <= data.until; ts += data.bucket_ms) byTs.set(ts, { ts } as Row);
    for (const p of data.series) {
      const row = byTs.get(p.ts) ?? ({ ts: p.ts } as Row);
      row[`d${p.device_id}`] = p[metric];
      byTs.set(p.ts, row);
    }
    const sorted = [...byTs.values()].sort((a, b) => a.ts - b.ts);
    // Where each line ends, so its name is written at its last point rather than read off colour alone.
    const last: Record<number, number> = {};
    sorted.forEach((r, i) => {
      for (const d of data.devices) if (r[`d${d.id}`] != null) last[d.id] = i;
    });
    return { rows: sorted, lastIndex: last };
  }, [data, metric]);

  const shortRange = data.range === "1h";
  const tickFormat = (ts: number) => (shortRange ? formatShortClock(ts) : formatDayClock(ts));

  return (
    <section className="card rise flex flex-col p-5" style={{ "--i": 2 } as CSSProperties}>
      <CardHead title={title} meta={`${RANGE_LABEL[data.range]} terakhir · rata-rata per ${formatBucket(data.bucket_ms)}`}>
        <Legend devices={data.devices} />
      </CardHead>
      {data.series.length < 2 ? (
        <p className="mt-4 flex min-h-64 flex-1 items-center justify-center rounded-lg border border-dashed border-line-strong px-6 text-center text-sm text-muted">
          Belum cukup pembacaan pada rentang ini. Jalankan alat atau simulator, lalu tunggu beberapa saat.
        </p>
      ) : (
        <div className="relative mt-4 min-h-[280px] flex-1">
          <div className="absolute inset-0">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={rows} margin={{ top: 8, right: 88, bottom: 0, left: -14 }}>
                <CartesianGrid stroke="var(--line)" vertical={false} />
                <XAxis
                  dataKey="ts"
                  type="number"
                  scale="time"
                  domain={[data.since, data.until]}
                  tickFormatter={tickFormat}
                  tick={AXIS}
                  axisLine={{ stroke: "var(--line-strong)" }}
                  tickLine={false}
                  minTickGap={56}
                  tickMargin={10}
                />
                <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tick={AXIS} axisLine={false} tickLine={false} width={52} tickFormatter={(v: number) => `${v}%`} />
                <Tooltip content={<FleetTip devices={data.devices} format={tickFormat} />} cursor={{ stroke: "var(--line-strong)", strokeWidth: 1 }} />
                {data.devices.map((d) => (
                  <Line
                    key={d.id}
                    type={metric === "stok_pakan" ? "stepAfter" : "monotone"}
                    dataKey={`d${d.id}`}
                    name={d.name}
                    stroke={seriesColor(d.id)}
                    strokeWidth={2}
                    // A reading with empty slots on both sides has no line to sit on; draw it as a dot.
                    dot={(p: { index?: number; cx?: number; cy?: number }) => {
                      const i = p.index ?? -1;
                      const key = `d${d.id}`;
                      const lone = rows[i]?.[key] != null && rows[i - 1]?.[key] == null && rows[i + 1]?.[key] == null;
                      return lone ? (
                        <circle key={`dot-${d.id}-${i}`} cx={p.cx} cy={p.cy} r={3} fill={seriesColor(d.id)} />
                      ) : (
                        <g key={`dot-${d.id}-${i}`} />
                      );
                    }}
                    activeDot={{ r: 5, strokeWidth: 2, stroke: "var(--surface)", fill: seriesColor(d.id) }}
                    isAnimationActive={false}
                    connectNulls={false}
                    label={(p: { index?: number; x?: number | string; y?: number | string }) =>
                      p.index === lastIndex[d.id] ? (
                        <text key={`end-${d.id}`} x={Number(p.x) + 8} y={Number(p.y) + 4} fontSize={11} fill="var(--muted)">
                          {d.name}
                        </text>
                      ) : (
                        <g key={`skip-${d.id}-${p.index}`} />
                      )
                    }
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </section>
  );
}

function formatBucket(ms: number): string {
  const minutes = ms / 60000;
  return minutes < 60 ? `${formatNumber(minutes)} menit` : `${formatNumber(minutes / 60, 1)} jam`;
}

function Legend({ devices }: { devices: DeviceAnalytics[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted" aria-label="Keterangan warna">
      {devices.map((d) => (
        <li key={d.id} className="flex items-center gap-2">
          <span className="h-[3px] w-3.5 rounded-full" style={{ background: seriesColor(d.id) }} aria-hidden="true" />
          {d.name}
          {d.simulated ? <span className="text-faint">(simulasi)</span> : null}
        </li>
      ))}
    </ul>
  );
}

type TipProps = {
  active?: boolean;
  label?: number;
  payload?: Array<{ dataKey?: string | number; value?: number | null }>;
  devices: DeviceAnalytics[];
  format: (ts: number) => string;
};

function FleetTip({ active, label, payload, devices, format }: TipProps) {
  if (!active || !payload?.length || label === undefined) return null;
  return (
    <div className="rounded-lg border border-line-strong bg-surface px-3.5 py-3 text-xs shadow-xl">
      <p className="tnum font-mono text-muted">{format(label)}</p>
      <dl className="mt-2 space-y-1.5">
        {devices.map((d) => {
          const v = payload.find((p) => p.dataKey === `d${d.id}`)?.value;
          return (
            <div key={d.id} className="flex items-center justify-between gap-6">
              <dt className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full" style={{ background: seriesColor(d.id) }} />
                {d.name}
              </dt>
              <dd className="tnum font-mono font-semibold">{v == null ? "—" : `${formatNumber(v)}%`}</dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}

function ComparisonTable({ data, now }: { data: Analytics; now: number }) {
  const pct = (v: number | null) => (v === null ? "—" : `${formatNumber(v)}%`);
  return (
    // min-w-0: a grid item otherwise grows to the table's width and the whole page scrolls sideways.
    <section className="card rise flex min-w-0 flex-col p-5" style={{ "--i": 3 } as CSSProperties}>
      <CardHead title="Perbandingan per akuarium" meta={`${RANGE_LABEL[data.range]} terakhir`} />
      <div className="mt-4 overflow-x-auto">
        <table className="tnum w-full text-left text-sm [&_td]:whitespace-nowrap [&_th]:whitespace-nowrap">
          <thead>
            <tr className="border-b border-line text-xs text-muted">
              <th scope="col" className="py-2 pr-4 font-medium">Akuarium</th>
              <th scope="col" className="py-2 pr-4 font-medium" title="Laporan diterima dibanding yang diharapkan tiap 5 detik">Ketersediaan</th>
              <th scope="col" className="py-2 pr-4 font-medium">Air rata-rata (min)</th>
              <th scope="col" className="py-2 pr-4 font-medium">Pakan rata-rata</th>
              <th scope="col" className="py-2 pr-4 font-medium">Pompa menyala</th>
              <th scope="col" className="py-2 pr-4 font-medium">Pakan diberikan</th>
              <th scope="col" className="py-2 pr-4 font-medium">Peringatan</th>
              <th scope="col" className="py-2 pr-4 font-medium">Perintah sah</th>
              <th scope="col" className="py-2 pr-4 font-medium">Respon</th>
              <th scope="col" className="py-2 font-medium">WiFi</th>
            </tr>
          </thead>
          <tbody>
            {data.devices.map((d) => (
              <tr key={d.id} className="border-b border-line last:border-0">
                <th scope="row" className="py-3 pr-4 font-semibold">
                  <span className="flex items-center gap-2 whitespace-nowrap">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: seriesColor(d.id) }} aria-hidden="true" />
                    {d.name}
                    {d.simulated ? <Tag>Simulasi</Tag> : null}
                    {!online(d, now) && <span className="text-xs font-normal text-faint">terputus</span>}
                  </span>
                </th>
                <td className="py-3 pr-4">{d.readings ? `${formatNumber(d.availability * 100)}%` : "—"}</td>
                <td className="py-3 pr-4">
                  {pct(d.avg_level)}
                  {d.min_level !== null && <span className="text-muted"> ({formatNumber(d.min_level)}%)</span>}
                </td>
                <td className="py-3 pr-4">{pct(d.avg_stock)}</td>
                <td className="py-3 pr-4">{d.pump_starts}×</td>
                <td className="py-3 pr-4">{d.feeds}×</td>
                <td className="py-3 pr-4">
                  {d.alerts.critical_water + d.alerts.critical_food}
                  <span className="text-xs text-muted"> (air {d.alerts.critical_water}, pakan {d.alerts.critical_food})</span>
                </td>
                <td className="py-3 pr-4">
                  {d.commands.acked}/{d.commands.total}
                  {d.commands.expired > 0 && <span className="text-xs text-muted"> · {d.commands.expired} kedaluwarsa</span>}
                </td>
                <td className="py-3 pr-4">{d.avg_response_ms === null ? "—" : `${formatNumber(d.avg_response_ms / 1000, 1)} dtk`}</td>
                <td className="py-3">{d.avg_rssi === null ? "—" : `${d.avg_rssi} dBm`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function AlertsChart({ data }: { data: Analytics }) {
  const rows = [
    { kind: "Air kritis", ...Object.fromEntries(data.devices.map((d) => [`d${d.id}`, d.alerts.critical_water])) },
    { kind: "Pakan menipis", ...Object.fromEntries(data.devices.map((d) => [`d${d.id}`, d.alerts.critical_food])) },
  ];
  const total = data.devices.reduce((s, d) => s + d.alerts.critical_water + d.alerts.critical_food, 0);

  return (
    <section className="card rise flex flex-col p-5" style={{ "--i": 4 } as CSSProperties}>
      <CardHead title="Peringatan per jenis" meta={`${RANGE_LABEL[data.range]} terakhir`}>
        <Legend devices={data.devices} />
      </CardHead>
      {total === 0 ? (
        <p className="mt-4 flex min-h-56 flex-1 items-center justify-center rounded-lg border border-dashed border-line-strong px-6 text-center text-sm text-muted">
          Tidak ada peringatan pada rentang ini.
        </p>
      ) : (
        <div className="mt-4 h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: -20 }} barGap={2} barCategoryGap="28%">
              <CartesianGrid stroke="var(--line)" vertical={false} />
              <XAxis dataKey="kind" tick={AXIS} axisLine={{ stroke: "var(--line-strong)" }} tickLine={false} tickMargin={8} />
              <YAxis allowDecimals={false} tick={AXIS} axisLine={false} tickLine={false} width={44} />
              <Tooltip cursor={{ fill: "var(--raised)" }} content={<AlertTip devices={data.devices} />} />
              {data.devices.map((d) => (
                <Bar key={d.id} dataKey={`d${d.id}`} name={d.name} fill={seriesColor(d.id)} radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}

function AlertTip({
  active,
  label,
  payload,
  devices,
}: {
  active?: boolean;
  label?: string;
  payload?: Array<{ dataKey?: string | number; value?: number }>;
  devices: DeviceAnalytics[];
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-line-strong bg-surface px-3.5 py-3 text-xs shadow-xl">
      <p className="font-medium text-muted">{label}</p>
      <dl className="mt-2 space-y-1.5">
        {devices.map((d) => (
          <div key={d.id} className="flex items-center justify-between gap-6">
            <dt className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full" style={{ background: seriesColor(d.id) }} />
              {d.name}
            </dt>
            <dd className="tnum font-mono font-semibold">{payload.find((p) => p.dataKey === `d${d.id}`)?.value ?? 0}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
