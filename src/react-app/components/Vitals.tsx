import type { CSSProperties, ReactNode } from "react";
import { formatUptime, nextFeeding, signalGrade } from "../lib/format";
import type { Reading } from "../lib/api";
import { Tag } from "./ui";

type Props = {
  reading: Reading | null;
  settings: Record<string, number>;
  now: number;
  stale: boolean;
};

function Cell({ label, children, sub }: { label: string; children: ReactNode; sub?: ReactNode }) {
  return (
    <div className="px-5 py-4">
      <p className="label">{label}</p>
      <div className="mt-2 flex items-center gap-2.5 text-[1.05rem] font-semibold leading-none">{children}</div>
      {sub && <p className="mt-2 text-xs text-muted">{sub}</p>}
    </div>
  );
}

function SignalBars({ bars, color }: { bars: number; color: string }) {
  return (
    <span className="flex h-4 items-end gap-[3px]" aria-hidden="true">
      {[1, 2, 3, 4].map((n) => (
        <span key={n} className="w-[3.5px] rounded-[1px]" style={{ height: 4 + n * 3, background: n <= bars ? color : "var(--line-strong)" }} />
      ))}
    </span>
  );
}

/** "dalam 3 jam 12 menit", for a time of day that is known to be in the future. */
function until(time: string, tomorrow: boolean, now: number): string {
  const [h, m] = time.split(":").map(Number);
  const target = new Date(now);
  target.setHours(h, m, 0, 0);
  if (tomorrow) target.setDate(target.getDate() + 1);
  const minutes = Math.max(0, Math.round((target.getTime() - now) / 60000));
  if (minutes < 1) return "sebentar lagi";
  const hours = Math.floor(minutes / 60);
  return hours === 0 ? `dalam ${minutes} menit` : `dalam ${hours} jam ${minutes % 60} menit`;
}

export function Vitals({ reading, settings, now, stale }: Props) {
  const grade = reading?.rssi != null ? signalGrade(reading.rssi) : null;
  const gradeColor = grade ? `var(--${grade.tone})` : "var(--faint)";
  const next = nextFeeding(settings, now);

  return (
    <section
      className="card rise grid grid-cols-2 divide-line max-xl:[&>*:nth-child(n+3)]:border-t max-xl:[&>*:nth-child(n+3)]:border-line xl:grid-cols-4 xl:divide-x"
      style={{ "--i": 3 } as CSSProperties}
      aria-label="Kondisi alat"
    >
      <Cell
        label="Sinyal WiFi"
        sub={reading?.rssi != null ? `${reading.rssi} dBm` : "belum ada pembacaan"}
      >
        <SignalBars bars={grade?.bars ?? 0} color={gradeColor} />
        {grade ? grade.label : "—"}
      </Cell>

      <Cell label="Alat menyala" sub="sejak boot terakhir">
        <span className="tnum">{formatUptime(reading?.uptime_ms ?? null)}</span>
      </Cell>

      <Cell label="Pompa" sub={`berhenti sendiri setelah ${settings.durasi_pompa ?? 5} detik`}>
        {reading ? (
          <Tag tone={reading.terkunci ? "danger" : reading.pompa ? "info" : "neutral"} dot>
            {reading.terkunci ? "Terkunci" : reading.pompa ? "Menyala" : "Mati"}
          </Tag>
        ) : (
          "—"
        )}
      </Cell>

      <Cell label="Pakan berikutnya" sub={until(next.time, next.tomorrow, now)}>
        <span className="tnum" style={{ opacity: stale ? 0.7 : 1 }}>
          {next.time}
        </span>
      </Cell>
    </section>
  );
}
