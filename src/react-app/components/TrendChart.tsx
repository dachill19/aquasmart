import { useMemo, useState, type CSSProperties } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { LineChart } from "lucide-react";
import type { HistoryPoint } from "../lib/api";
import { formatClock, formatNumber, formatShortClock } from "../lib/format";
import { SectionTitle } from "./ui";

type Props = { points: HistoryPoint[]; thresholdAir: number; targetAir: number };

type SeriesKey = "level_air" | "stok_pakan" | "pump";

const AXIS = { fill: "var(--muted)", fontSize: 11, fontFamily: "var(--font-mono)" } as const;

function Legend({
  active,
  onToggle,
}: {
  active: Record<SeriesKey, boolean>;
  onToggle: (k: SeriesKey) => void;
}) {
  const items: Array<{ key: SeriesKey; label: string; swatch: string }> = [
    { key: "level_air", label: "Ketinggian air", swatch: "var(--accent)" },
    { key: "stok_pakan", label: "Stok pakan", swatch: "var(--feed)" },
    { key: "pump", label: "Pompa menyala", swatch: "color-mix(in oklab, var(--aqua) 55%, transparent)" },
  ];
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Pilih seri yang ditampilkan">
      {items.map((it) => (
        <button
          key={it.key}
          type="button"
          aria-pressed={active[it.key]}
          onClick={() => onToggle(it.key)}
          className="flex items-center gap-2 rounded-full border border-line-strong px-3 py-1.5 text-xs font-medium transition-colors hover:border-accent aria-pressed:bg-raised aria-[pressed=false]:opacity-50"
        >
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: it.swatch }} />
          {it.label}
        </button>
      ))}
    </div>
  );
}

type TipProps = { active?: boolean; payload?: Array<{ payload: HistoryPoint }> };

function Tip({ active, payload }: TipProps) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-xl border border-line-strong bg-[color-mix(in_oklab,var(--bg)_88%,var(--surface))] px-3.5 py-3 text-xs shadow-xl backdrop-blur">
      <p className="tnum font-mono text-muted">{formatClock(p.ts)}</p>
      <dl className="mt-2 space-y-1.5">
        {p.level_air !== null && (
          <div className="flex items-center justify-between gap-6">
            <dt className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-accent" />
              Air
            </dt>
            <dd className="tnum font-mono font-semibold">{formatNumber(p.level_air)}%</dd>
          </div>
        )}
        {p.stok_pakan !== null && (
          <div className="flex items-center justify-between gap-6">
            <dt className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-feed" />
              Pakan
            </dt>
            <dd className="tnum font-mono font-semibold">{formatNumber(p.stok_pakan)}%</dd>
          </div>
        )}
        <div className="flex items-center justify-between gap-6 text-muted">
          <dt>Pompa</dt>
          <dd>{p.pompa ? "menyala" : "mati"}</dd>
        </div>
      </dl>
    </div>
  );
}

export function TrendChart({ points, thresholdAir, targetAir }: Props) {
  const [active, setActive] = useState<Record<SeriesKey, boolean>>({ level_air: true, stok_pakan: true, pump: true });

  const data = useMemo(() => points.filter((p) => p.level_air !== null || p.stok_pakan !== null), [points]);

  /**
   * Stretches where the pump was running, drawn behind the lines. Whether the
   * level actually answered the pump is the question this chart exists to
   * settle, and the water line alone cannot say it. A run ends at the first
   * reading that reports the pump off, so a single reading keeps some width.
   */
  const pumpRuns = useMemo(() => {
    const runs: Array<[number, number]> = [];
    let start: number | null = null;
    data.forEach((p, i) => {
      if (p.pompa && start === null) start = i;
      if (!p.pompa && start !== null) {
        runs.push([data[start].ts, p.ts]);
        start = null;
      }
    });
    if (start !== null) runs.push([data[start].ts, data[data.length - 1].ts]);
    return runs;
  }, [data]);

  const spanMin = data.length >= 2 ? Math.max(1, Math.round((data[data.length - 1].ts - data[0].ts) / 60000)) : 0;

  return (
    <section className="card rise flex flex-col p-5 sm:p-7" style={{ "--i": 7 } as CSSProperties}>
      <SectionTitle
        icon={<LineChart size={18} />}
        title="Riwayat pembacaan"
        hint={spanMin ? `${data.length} pembacaan dalam ${spanMin} menit terakhir` : "Pembacaan terbaru dari alat"}
        right={<Legend active={active} onToggle={(k) => setActive((a) => ({ ...a, [k]: !a[k] }))} />}
      />

      {data.length < 2 ? (
        <p className="mt-5 flex min-h-64 items-center justify-center rounded-2xl border border-dashed border-line-strong px-6 text-center text-sm text-muted">
          {data.length === 0
            ? "Belum ada pembacaan tersimpan. Grafik muncul setelah alat mengirim beberapa laporan."
            : "Baru satu pembacaan tersimpan. Grafik butuh sedikitnya dua titik."}
        </p>
      ) : (
        <div className="mt-6 h-72 w-full sm:h-80">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 8, right: 28, bottom: 0, left: -14 }}>
              <defs>
                <linearGradient id="fill-water" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="var(--accent)" stopOpacity="0.38" />
                  <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--line)" vertical={false} />
              <XAxis
                dataKey="ts"
                type="number"
                scale="time"
                domain={["dataMin", "dataMax"]}
                tickFormatter={formatShortClock}
                tick={AXIS}
                axisLine={{ stroke: "var(--line-strong)" }}
                tickLine={false}
                minTickGap={56}
                tickMargin={10}
              />
              <YAxis
                domain={[0, 100]}
                ticks={[0, 25, 50, 75, 100]}
                tick={AXIS}
                axisLine={false}
                tickLine={false}
                width={52}
                tickFormatter={(v: number) => `${v}%`}
              />

              {active.pump &&
                pumpRuns.map(([from, to]) => (
                  <ReferenceArea key={from} x1={from} x2={to} fill="var(--aqua)" fillOpacity={0.16} stroke="none" ifOverflow="hidden" />
                ))}

              <ReferenceLine
                y={thresholdAir}
                stroke="var(--danger)"
                strokeOpacity={0.8}
                strokeDasharray="5 5"
                label={{ value: `ambang ${thresholdAir}%`, position: "insideBottomLeft", offset: 6, fill: "var(--danger)", fontSize: 10.5, fontFamily: "var(--font-mono)" }}
              />
              <ReferenceLine
                y={targetAir}
                stroke="var(--muted)"
                strokeOpacity={0.7}
                strokeDasharray="2 5"
                label={{ value: `target ${targetAir}%`, position: "insideTopLeft", offset: 6, fill: "var(--muted)", fontSize: 10.5, fontFamily: "var(--font-mono)" }}
              />

              <Tooltip content={<Tip />} cursor={{ stroke: "var(--line-strong)", strokeWidth: 1 }} />

              {active.level_air && (
                <Area
                  type="monotone"
                  dataKey="level_air"
                  stroke="var(--accent)"
                  strokeWidth={2.5}
                  fill="url(#fill-water)"
                  dot={false}
                  activeDot={{ r: 5, strokeWidth: 2, stroke: "var(--bg)", fill: "var(--accent)" }}
                  isAnimationActive={false}
                  connectNulls
                />
              )}
              {/* Feed stock moves in steps of about 20%, so a smooth curve would claim precision it lacks. */}
              {active.stok_pakan && (
                <Line
                  type="stepAfter"
                  dataKey="stok_pakan"
                  stroke="var(--feed)"
                  strokeWidth={2.25}
                  dot={false}
                  activeDot={{ r: 5, strokeWidth: 2, stroke: "var(--bg)", fill: "var(--feed)" }}
                  isAnimationActive={false}
                  connectNulls
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}
