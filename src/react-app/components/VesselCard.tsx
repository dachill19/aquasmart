import type { CSSProperties, ReactNode } from "react";
import { Info } from "lucide-react";
import { formatNumber } from "../lib/format";
import { useTween } from "../lib/useTween";
import { Tag, type Tone } from "./ui";

type Props = {
  index: number;
  label: string;
  value: number | null;
  loading: boolean;
  stale: boolean;
  critical: boolean;
  status: { text: string; tone: Tone } | null;
  /** The raw figures behind the percentage, one per line, printed under the headline. */
  readout: string[];
  visual: ReactNode;
  /** A short history of the same quantity, so the figure is read against where it has been. */
  trend?: ReactNode;
  stats: Array<{ k: string; v: string }>;
  /** Hardware limit the reader should know about, stated rather than hidden. */
  note?: string;
};

export function VesselCard({ index, label, value, loading, stale, critical, status, readout, visual, trend, stats, note }: Props) {
  const shown = useTween(value);
  const color = critical ? "var(--danger)" : "var(--fg)";

  return (
    <section className="card rise @container flex flex-col p-5" style={{ "--i": index } as CSSProperties}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[0.95rem] font-semibold tracking-tight">{label}</h2>
        {status && !loading && (
          <Tag tone={stale ? "neutral" : status.tone} dot>
            {status.text}
          </Tag>
        )}
      </div>

      <div className="mt-4 grid flex-1 gap-5 @[30rem]:grid-cols-[minmax(0,1fr)_minmax(0,min(24rem,52cqw))] @[30rem]:items-center">
        <div className="flex h-full flex-col">
          {loading ? (
            <div className="skeleton h-[5.5rem] w-48" />
          ) : shown !== null ? (
            <p
              className="flex items-baseline leading-[0.85] tracking-[-0.055em] transition-colors duration-500"
              style={{ color, opacity: stale ? 0.6 : 1 }}
            >
              <span className="tnum text-[clamp(4.5rem,15cqw,7.25rem)] font-medium">{formatNumber(shown)}</span>
              <span className="ml-1 text-[1.75rem] font-normal tracking-normal text-muted">%</span>
            </p>
          ) : (
            <p className="text-[clamp(4.5rem,15cqw,7.25rem)] font-medium leading-[0.85] tracking-[-0.055em] text-faint">&mdash;</p>
          )}
          <p className="tnum mt-3 font-mono text-[0.74rem] leading-relaxed text-muted">
            {value === null ? "belum ada pembacaan" : readout.map((line) => <span key={line} className="block">{line}</span>)}
          </p>

          <div className="pt-5 @[30rem]:mt-auto">
          {trend && <div className="mb-4">{trend}</div>}
          <dl className="grid grid-cols-3 divide-x divide-line border-t border-line @[30rem]:grid-cols-1 @[30rem]:divide-x-0 @[30rem]:divide-y">
            {stats.map((s) => (
              <div key={s.k} className="py-2.5 pl-3 first:pl-0 @[30rem]:flex @[30rem]:items-baseline @[30rem]:justify-between @[30rem]:pl-0">
                <dt className="label">{s.k}</dt>
                <dd className="tnum mt-1 truncate text-[0.9rem] font-semibold @[30rem]:mt-0">{s.v}</dd>
              </div>
            ))}
          </dl>

          {note && (
            <p className="mt-3 flex items-start gap-2 text-xs leading-relaxed text-muted">
              <Info size={13} className="mt-[3px] shrink-0 text-faint" aria-hidden="true" />
              {note}
            </p>
          )}
          </div>
        </div>

        <div className="mx-auto w-full max-w-[24rem]">{visual}</div>
      </div>
    </section>
  );
}
