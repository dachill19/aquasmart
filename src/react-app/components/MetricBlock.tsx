import { formatNumber } from "../lib/format";

export type ContextRow = { k: string; v: string };

type Props = {
  label: string;
  value: number | null;
  threshold: number;
  /** Small exact figures printed under the headline, the way a form shows its workings. */
  readout: string;
  emptyNote: string;
  /** Ruled entries that keep the cell a filled field rather than empty ground. */
  rows: ContextRow[];
};

const SEGMENTS = 10;

export function MetricBlock({ label, value, threshold, readout, emptyNote, rows }: Props) {
  const known = value !== null;
  const critical = known && value < threshold;
  const filled = known ? Math.round((value / 100) * SEGMENTS) : 0;

  return (
    <section className="flex flex-col border-b border-[var(--rule)] px-6 py-7 sm:px-10 lg:border-b-0 lg:border-r">
      <h2 className="label">{label}</h2>

      {known ? (
        <p className="mt-3 flex items-baseline font-bold leading-[0.85] tracking-[-0.03em]">
          <span className="tnum text-[clamp(3.5rem,8vw,6.5rem)]">{formatNumber(value)}</span>
          <span
            className="ml-1 text-2xl font-semibold"
            style={{ color: critical ? "var(--stamp)" : "var(--blue-live)" }}
          >
            %
          </span>
        </p>
      ) : (
        <p className="mt-3 text-[clamp(2rem,4vw,3rem)] font-bold leading-tight text-[var(--ink-muted)]">
          &mdash;
        </p>
      )}

      <p className="tnum mt-2 font-mono text-xs text-[var(--ink-muted)] sm:text-sm">
        {known ? readout : emptyNote}
      </p>

      {/* The threshold is marked on the scale itself, not described beside it. */}
      <div className="relative mt-6">
        <div
          className="flex gap-[3px]"
          role="img"
          aria-label={`${label} ${known ? `${value} persen` : "tidak diketahui"}, ambang ${threshold} persen`}
        >
          {Array.from({ length: SEGMENTS }, (_, i) => {
            const on = i < filled;
            return (
              <span
                key={i}
                className="h-6 flex-1 border-t"
                style={{
                  background: on ? (critical ? "var(--stamp)" : "var(--blue)") : "var(--panel-2)",
                  borderTopColor: on
                    ? critical
                      ? "var(--stamp)"
                      : "var(--blue-live)"
                    : "var(--rule)",
                }}
              />
            );
          })}
        </div>

        {/* Stamp red is the exception ink, so the tick only takes it on a gauge
            that is actually under its threshold. */}
        <span
          aria-hidden="true"
          className="absolute -top-1 bottom-[-6px] w-px"
          style={{ left: `${threshold}%`, background: critical ? "var(--stamp)" : "var(--ink-muted)" }}
        />
        <span
          aria-hidden="true"
          className="absolute -translate-x-1/2 font-mono text-[11px]"
          style={{
            left: `${threshold}%`,
            top: "calc(100% + 8px)",
            color: critical ? "var(--stamp)" : "var(--ink-muted)",
          }}
        >
          {threshold}%
        </span>
      </div>

      <p className="mt-2 flex justify-between font-mono text-xs text-[var(--ink-muted)]">
        <span>0%</span>
        <span>100%</span>
      </p>

      <dl className="mt-auto divide-y divide-[var(--rule-soft)] border-t border-[var(--rule)] pt-0 text-sm">
        {rows.map((row) => (
          <div key={row.k} className="flex items-baseline justify-between gap-4 py-2.5">
            <dt className="label">{row.k}</dt>
            <dd className="tnum font-mono text-[var(--ink)]">{row.v}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
