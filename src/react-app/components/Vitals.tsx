import type { CSSProperties, ReactNode } from "react";
import { CalendarClock, Clock3, Power, Wifi } from "lucide-react";
import { formatUptime, nextFeeding, signalGrade } from "../lib/format";
import type { Reading } from "../lib/api";
import { Chip } from "./ui";

type Props = {
  reading: Reading | null;
  settings: Record<string, number>;
  now: number;
  stale: boolean;
};

function Cell({ icon, label, children, i }: { icon: ReactNode; label: string; children: ReactNode; i: number }) {
  return (
    <div className="card rise flex items-center gap-4 px-5 py-4" style={{ "--i": i } as CSSProperties}>
      <span
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-line-strong bg-raised text-accent"
        aria-hidden="true"
      >
        {icon}
      </span>
      <div className="min-w-0">
        <p className="eyebrow">{label}</p>
        <div className="mt-2">{children}</div>
      </div>
    </div>
  );
}

function SignalBars({ bars, color }: { bars: number; color: string }) {
  return (
    <span className="flex h-[18px] items-end gap-[3px]" aria-hidden="true">
      {[1, 2, 3, 4].map((n) => (
        <span
          key={n}
          className="w-[4px] rounded-[1.5px]"
          style={{ height: 4 + n * 3.5, background: n <= bars ? color : "var(--line-strong)" }}
        />
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
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Cell i={3} icon={<Wifi size={20} />} label="Sinyal WiFi">
        <div className="flex items-center gap-3">
          <SignalBars bars={grade?.bars ?? 0} color={gradeColor} />
          <p className="tnum text-[1.05rem] font-semibold leading-none">
            {grade ? grade.label : "—"}
            {reading?.rssi != null && <span className="ml-2 font-mono text-xs font-normal text-muted">{reading.rssi} dBm</span>}
          </p>
        </div>
      </Cell>

      <Cell i={4} icon={<Clock3 size={20} />} label="Alat menyala">
        <p className="tnum text-[1.05rem] font-semibold leading-none">{formatUptime(reading?.uptime_ms ?? null)}</p>
      </Cell>

      <Cell i={5} icon={<Power size={20} />} label="Pompa">
        <div className="flex items-center gap-2.5">
          {reading ? (
            <Chip tone={reading.terkunci ? "danger" : reading.pompa ? "info" : "neutral"} dot>
              {reading.terkunci ? "Terkunci" : reading.pompa ? "Menyala" : "Mati"}
            </Chip>
          ) : (
            <span className="text-[1.05rem] font-semibold leading-none">—</span>
          )}
          <span className="text-xs text-muted">maks {settings.durasi_pompa ?? 5} detik</span>
        </div>
      </Cell>

      <Cell i={6} icon={<CalendarClock size={20} />} label="Pakan berikutnya">
        <p className="tnum text-[1.05rem] font-semibold leading-none" style={{ opacity: stale ? 0.7 : 1 }}>
          {next.time}
          <span className="ml-2 text-xs font-normal text-muted">{until(next.time, next.tomorrow, now)}</span>
        </p>
      </Cell>
    </div>
  );
}
