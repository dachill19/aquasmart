import type { CSSProperties, ReactNode } from "react";
import { Droplet, History, Info, LockOpen, Power, Settings2, TriangleAlert, UtensilsCrossed } from "lucide-react";
import type { CommandRow, EventRow } from "../lib/api";
import { COMMAND_LABEL, formatClock, formatDayClock } from "../lib/format";
import { Chip, SectionTitle, type Tone } from "./ui";

type Entry = {
  key: string;
  ts: number;
  icon: ReactNode;
  tone: Tone;
  text: string;
  /** What the dashboard knows about it, never a measured outcome it does not have. */
  meta: string | null;
  state: { label: string; tone: Tone } | null;
};

const SHOWN = 12;

function describeCommand(c: CommandRow, settings: Record<string, number>): Pick<Entry, "icon" | "text" | "meta"> {
  const label = COMMAND_LABEL[c.type] ?? c.type;
  if (c.type === "feed") {
    return { icon: <UtensilsCrossed size={16} />, text: label, meta: `servo disetel ${settings.durasi_pakan ?? 3} detik` };
  }
  if (c.type === "pump") {
    const on = (c.payload ? (JSON.parse(c.payload) as { on?: boolean }) : {}).on;
    return {
      icon: <Power size={16} />,
      text: `${label}: ${on ? "nyalakan" : "matikan"}`,
      meta: on ? `berhenti sendiri maks ${settings.durasi_pompa ?? 5} detik` : null,
    };
  }
  if (c.type === "unlock") return { icon: <LockOpen size={16} />, text: label, meta: null };
  const keys = c.payload ? Object.keys(JSON.parse(c.payload) as Record<string, unknown>) : [];
  return { icon: <Settings2 size={16} />, text: label, meta: keys.length ? `${keys.length} nilai: ${keys.slice(0, 3).join(", ")}${keys.length > 3 ? "…" : ""}` : null };
}

function describeEvent(e: EventRow): Pick<Entry, "icon" | "tone"> {
  if (e.kind === "critical_water") return { icon: <Droplet size={16} />, tone: "danger" };
  if (e.kind.startsWith("critical")) return { icon: <TriangleAlert size={16} />, tone: "danger" };
  if (e.kind === "feed_done") return { icon: <UtensilsCrossed size={16} />, tone: "ok" };
  return { icon: <Info size={16} />, tone: "info" };
}

export function Activity({
  events,
  commands,
  settings,
}: {
  events: EventRow[];
  commands: CommandRow[];
  settings: Record<string, number>;
}) {
  const entries: Entry[] = [
    ...commands.map((c): Entry => {
      const pending = c.acked_at === null && !c.expired;
      return {
        key: `c${c.id}`,
        ts: c.ts,
        tone: pending ? "info" : c.expired ? "neutral" : "ok",
        ...describeCommand(c, settings),
        state: pending
          ? { label: "Menunggu alat", tone: "info" }
          : c.expired
            ? { label: "Kedaluwarsa", tone: "neutral" }
            : { label: `Disahkan ${formatClock(c.acked_at!)}`, tone: "ok" },
      };
    }),
    ...events.map((e): Entry => ({
      key: `e${e.id}`,
      ts: e.ts,
      text: e.message,
      meta: "dilaporkan alat",
      state: null,
      ...describeEvent(e),
    })),
  ].sort((a, b) => b.ts - a.ts);

  return (
    <section className="card rise flex flex-col p-5 sm:p-7" style={{ "--i": 8 } as CSSProperties}>
      <SectionTitle icon={<History size={18} />} title="Aktivitas" hint="Perintah Anda dan laporan dari alat" />

      {entries.length === 0 ? (
        <p className="mt-5 rounded-2xl border border-dashed border-line-strong px-4 py-8 text-center text-sm text-muted">
          Belum ada aktivitas. Baris pertama muncul begitu alat melapor atau Anda mengirim perintah.
        </p>
      ) : (
        <ol className="relative mt-6 flex-1">
          <span aria-hidden="true" className="absolute bottom-3 left-[17px] top-3 w-px bg-line-strong" />
          {entries.slice(0, SHOWN).map((e, i) => {
            const color = e.tone === "neutral" ? "var(--muted)" : `var(--${e.tone === "info" ? "accent" : e.tone})`;
            return (
              <li key={e.key} className={`relative flex gap-4 pb-5 last:pb-0 ${i === 0 ? "slide-in" : ""}`}>
                <span
                  aria-hidden="true"
                  className="relative z-10 flex h-[35px] w-[35px] shrink-0 items-center justify-center rounded-full border bg-[var(--bg)]"
                  style={{ color, borderColor: `color-mix(in oklab, ${color} 45%, transparent)` }}
                >
                  {e.icon}
                </span>
                <div className="min-w-0 flex-1 pt-0.5">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-[0.88rem] font-medium leading-snug" style={{ color: e.tone === "danger" ? "var(--danger)" : undefined }}>
                      {e.text}
                    </p>
                    <time className="tnum shrink-0 font-mono text-[0.7rem] text-muted" dateTime={new Date(e.ts).toISOString()}>
                      {formatClock(e.ts)}
                    </time>
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                    {e.state && <Chip tone={e.state.tone}>{e.state.label}</Chip>}
                    {e.meta && <span className="text-xs text-muted">{e.meta}</span>}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {entries.length > SHOWN && (
        <p className="mt-5 font-mono text-xs text-muted">
          {SHOWN} terbaru dari {entries.length} · terlama {formatDayClock(entries[entries.length - 1].ts)}
        </p>
      )}
    </section>
  );
}
