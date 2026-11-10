import { useMemo } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { HistoryPoint } from "../lib/api";
import { formatClock, formatNumber } from "../lib/format";

type Props = {
  points: HistoryPoint[];
  thresholdAir: number;
  targetAir: number;
};

export function HistoryChart({ points, thresholdAir, targetAir }: Props) {
  const data = points
    .filter((p) => p.level_air !== null || p.stok_pakan !== null)
    .map((p) => ({ ...p, label: formatClock(p.ts) }));

  /**
   * Stretches of readings where the pump was running, drawn behind the lines.
   * Whether the level actually answered the pump is the question this chart
   * exists to settle, and the water line alone cannot say it.
   *
   * A run ends at the first reading that reports the pump off, so a run of a
   * single reading still has width instead of collapsing to nothing.
   */
  const pumpRuns = useMemo(() => {
    const runs: Array<[string, string]> = [];
    let start: number | null = null;
    data.forEach((p, i) => {
      if (p.pompa && start === null) start = i;
      if (!p.pompa && start !== null) {
        runs.push([data[start].label, p.label]);
        start = null;
      }
    });
    if (start !== null) runs.push([data[start].label, data[data.length - 1].label]);
    return runs;
  }, [data]);

  return (
    <section className="border-t border-[var(--rule)]">
      <div className="mx-auto max-w-[1680px] px-6 sm:px-10">
        <div className="flex flex-wrap items-baseline justify-between gap-3 py-5">
          <h2 className="label">Riwayat pembacaan</h2>
          <p className="flex flex-wrap gap-x-5 gap-y-1 font-mono text-xs text-[var(--ink-muted)]">
            <span className="flex items-center gap-2">
              <span className="inline-block h-[3px] w-5" style={{ background: "var(--blue-live)" }} />
              ketinggian air
            </span>
            <span className="flex items-center gap-2">
              <span className="inline-block h-[3px] w-5" style={{ background: "var(--ok)" }} />
              stok pakan
            </span>
            <span className="flex items-center gap-2">
              <span
                className="inline-block h-3 w-5"
                style={{ background: "var(--blue)", opacity: 0.35 }}
              />
              pompa menyala
            </span>
          </p>
        </div>

        {data.length < 2 ? (
          <p className="border-t border-[var(--rule-soft)] py-10 text-sm text-[var(--ink-muted)]">
            {data.length === 0
              ? "Belum ada pembacaan tersimpan. Grafik muncul setelah alat mengirim beberapa laporan."
              : "Baru satu pembacaan tersimpan. Grafik butuh sedikitnya dua titik."}
          </p>
        ) : (
          <div className="h-64 w-full border-t border-[var(--rule-soft)] pt-4 pb-10">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
                <CartesianGrid stroke="var(--rule-soft)" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: "var(--ink-muted)", fontSize: 11, fontFamily: "var(--font-mono)" }}
                  axisLine={{ stroke: "var(--rule)" }}
                  tickLine={false}
                  minTickGap={48}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fill: "var(--ink-muted)", fontSize: 11, fontFamily: "var(--font-mono)" }}
                  axisLine={false}
                  tickLine={false}
                  width={58}
                  tickFormatter={(v: number) => `${v}%`}
                />
                {pumpRuns.map(([from, to]) => (
                  <ReferenceArea
                    key={`${from}-${to}`}
                    x1={from}
                    x2={to}
                    fill="var(--blue)"
                    fillOpacity={0.22}
                    stroke="none"
                  />
                ))}
                <ReferenceLine
                  y={thresholdAir}
                  stroke="var(--stamp)"
                  strokeDasharray="4 4"
                  label={{
                    value: `ambang ${thresholdAir}%`,
                    position: "insideBottomLeft",
                    offset: 8,
                    fill: "var(--stamp)",
                    fontSize: 11,
                    fontFamily: "var(--font-mono)",
                  }}
                />
                <ReferenceLine
                  y={targetAir}
                  stroke="var(--ink-muted)"
                  strokeDasharray="2 4"
                  label={{
                    value: `target isi ${targetAir}%`,
                    position: "insideTopLeft",
                    offset: 8,
                    fill: "var(--ink-muted)",
                    fontSize: 11,
                    fontFamily: "var(--font-mono)",
                  }}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--panel)",
                    border: "1px solid var(--rule)",
                    borderRadius: 0,
                    fontFamily: "var(--font-mono)",
                    fontSize: 12,
                    color: "var(--ink)",
                  }}
                  labelStyle={{ color: "var(--ink-muted)" }}
                  formatter={(value, name) => [
                    `${formatNumber(Number(value))}%`,
                    String(name) === "level_air" ? "ketinggian air" : "stok pakan",
                  ]}
                />
                <Line
                  type="monotone"
                  dataKey="level_air"
                  stroke="var(--blue-live)"
                  strokeWidth={2.5}
                  dot={false}
                  isAnimationActive={false}
                  connectNulls
                />
                <Line
                  type="monotone"
                  dataKey="stok_pakan"
                  stroke="var(--ok)"
                  strokeWidth={2.5}
                  dot={false}
                  isAnimationActive={false}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </section>
  );
}
