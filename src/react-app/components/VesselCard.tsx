import type { CSSProperties, ReactNode } from "react";
import { Info } from "lucide-react";
import { formatNumber } from "../lib/format";
import { useTween } from "../lib/useTween";
import { Chip, type Tone } from "./ui";

type Props = {
  index: number;
  icon: ReactNode;
  label: string;
  value: number | null;
  loading: boolean;
  stale: boolean;
  critical: boolean;
  status: { text: string; tone: Tone } | null;
  /** The raw figure behind the percentage, printed under the headline. */
  readout: string[];
  visual: ReactNode;
  stats: Array<{ k: string; v: string }>;
  /** Hardware limit the reader should know about, stated rather than hidden. */
  note?: string;
};

export function VesselCard({ index, icon, label, value, loading, stale, critical, status, readout, visual, stats, note }: Props) {
  const shown = useTween(value);
  const color = critical ? "var(--danger)" : "var(--fg)";

  return (
    <section className="card rise @container p-5 sm:p-7" style={{ "--i": index } as CSSProperties}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5 text-muted">
          <span className="text-accent" aria-hidden="true">
            {icon}
          </span>
          <h2 className="eyebrow">{label}</h2>
        </div>
        {status && !loading && <Chip tone={stale ? "neutral" : status.tone} dot>{status.text}</Chip>}
      </div>

      <div className="mt-5 grid gap-6 @[34rem]:grid-cols-[minmax(0,1fr)_minmax(0,21.5rem)] @[34rem]:items-center">
        <div className="flex h-full flex-col">
          {loading ? (
            <div className="skeleton h-[5.5rem] w-52" />
          ) : shown !== null ? (
            <p
              className="flex items-baseline leading-[0.82] tracking-[-0.045em] transition-colors duration-500"
              style={{ color, opacity: stale ? 0.6 : 1 }}
            >
              <span className="tnum text-[clamp(4.25rem,9vw,6.5rem)] font-semibold">{formatNumber(shown)}</span>
              <span className="ml-1.5 text-[2rem] font-medium text-muted">%</span>
            </p>
          ) : (
            <p className="text-[clamp(4rem,8vw,6rem)] font-semibold leading-[0.82] tracking-[-0.045em] text-faint">&mdash;</p>
          )}
          <p className="tnum mt-3 font-mono text-[0.76rem] leading-relaxed text-muted">
            {value === null ? "belum ada pembacaan" : readout.map((line) => <span key={line} className="block">{line}</span>)}
          </p>

          <dl className="mt-6 grid grid-cols-3 gap-px overflow-hidden rounded-2xl border border-line bg-line @[34rem]:mt-auto @[34rem]:grid-cols-1">
            {stats.map((s) => (
              <div key={s.k} className="flex flex-col bg-[color-mix(in_oklab,var(--bg)_55%,var(--surface))] px-3.5 py-3 @[34rem]:flex-row @[34rem]:items-center @[34rem]:justify-between">
                <dt className="eyebrow !text-[0.625rem]">{s.k}</dt>
                <dd className="tnum mt-1.5 truncate text-[0.9rem] font-semibold @[34rem]:mt-0">{s.v}</dd>
              </div>
            ))}
          </dl>

          {note && (
            <p className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-muted">
              <Info size={14} className="mt-px shrink-0 text-faint" aria-hidden="true" />
              {note}
            </p>
          )}
        </div>

        <div className="mx-auto w-full max-w-[400px]">{visual}</div>
      </div>
    </section>
  );
}
