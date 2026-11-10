import { useEffect, useRef } from "react";
import type { CommandRow, EventRow } from "../lib/api";
import { COMMAND_LABEL, formatClock, formatDayClock, formatNumber } from "../lib/format";

type Entry = {
  key: string;
  ts: number;
  text: string;
  /**
   * The configured run time for this action, drawn as length rather than written
   * as a word. The server never measures how long the servo or pump actually ran,
   * so the cell says "disetel" and never passes a setting off as a measurement.
   */
  durationSec: number | null;
  ackedAt: number | null;
  pending: boolean;
  critical: boolean;
};

/** The longest bar on screen; anything longer is clamped and still labelled exactly. */
const BAR_FULL_SEC = 15;

function describeCommand(c: CommandRow): string {
  const base = COMMAND_LABEL[c.type] ?? c.type;
  if (c.type === "pump") {
    const payload = c.payload ? (JSON.parse(c.payload) as { on?: boolean }) : {};
    return `${base}: ${payload.on ? "nyalakan" : "matikan"}`;
  }
  if (c.type === "settings" && c.payload) {
    const keys = Object.keys(JSON.parse(c.payload) as Record<string, unknown>);
    return `${base} (${keys.join(", ")})`;
  }
  return base;
}

export function RecordTable({
  events,
  commands,
  settings,
}: {
  events: EventRow[];
  commands: CommandRow[];
  settings: Record<string, number>;
}) {
  // The stamp animates only on a row that landed while this page was open, so a
  // reload does not replay five entrances at once.
  const settled = useRef<Set<string> | null>(null);
  // A key stays here until the animation reports itself finished. The page
  // re-renders every second for the clock, so clearing on the next render
  // instead would cut the mark off mid-landing.
  const landing = useRef<Set<string>>(new Set());

  const entries: Entry[] = [
    ...commands.map((c) => ({
      key: `c${c.id}`,
      ts: c.ts,
      text: describeCommand(c),
      durationSec:
        c.type === "feed" ? (settings.durasi_pakan ?? null) : c.type === "pump" ? (settings.durasi_pompa ?? null) : null,
      ackedAt: c.acked_at,
      pending: c.acked_at === null,
      critical: false,
    })),
    ...events.map((e) => ({
      key: `e${e.id}`,
      ts: e.ts,
      text: e.message,
      durationSec: null,
      ackedAt: e.ts,
      pending: false,
      critical: e.kind.startsWith("critical"),
    })),
  ].sort((a, b) => b.ts - a.ts);

  const stampedNow = new Set(entries.filter((e) => !e.pending).map((e) => e.key));
  if (settled.current === null) {
    // First paint: everything already on the record counts as filed long ago.
    settled.current = stampedNow;
  } else {
    for (const key of stampedNow) {
      if (!settled.current.has(key)) landing.current.add(key);
    }
  }

  useEffect(() => {
    settled.current = stampedNow;
    // stampedNow is derived from the rendered entries, so this runs once per render.
  });

  return (
    <section className="border-t border-[var(--rule)]">
      <div className="mx-auto max-w-[1680px] px-6 sm:px-10">
        <h2 className="label py-5">Catatan</h2>

        {entries.length === 0 ? (
          <p className="border-t border-[var(--rule-soft)] py-10 text-sm text-[var(--ink-muted)]">
            Belum ada catatan. Baris pertama akan muncul begitu alat melapor atau Anda mengirim perintah.
          </p>
        ) : (
          <div className="w-full min-w-0 overflow-x-auto pb-10">
            <table className="w-full border-collapse text-sm sm:min-w-[640px]">
              <thead>
                <tr className="border-y border-[var(--rule)]">
                  <th className="label py-3 pr-4 text-left font-semibold">Waktu</th>
                  <th className="label py-3 pr-4 text-left font-semibold">Catatan</th>
                  <th className="label hidden py-3 pr-4 text-left font-semibold sm:table-cell">
                    Durasi (disetel)
                  </th>
                  <th className="label py-3 text-right font-semibold">Pengesahan</th>
                </tr>
              </thead>
              <tbody>
                {entries.slice(0, 14).map((entry) => (
                  <tr key={entry.key} className="border-b border-[var(--rule-soft)] align-middle">
                    <td className="tnum w-16 py-3 pr-3 align-top font-mono text-xs text-[var(--ink-muted)] sm:w-28 sm:pr-4 sm:align-middle">
                      {formatClock(entry.ts)}
                    </td>
                    <td
                      className="py-3 pr-3 align-top sm:pr-4 sm:align-middle"
                      style={{ color: entry.critical ? "var(--stamp)" : "var(--ink)" }}
                    >
                      {entry.text}
                    </td>
                    <td className="hidden w-48 py-3 pr-4 sm:table-cell">
                      {entry.durationSec === null ? (
                        <span className="text-[var(--ink-muted)]">&mdash;</span>
                      ) : (
                        <span className="flex items-center gap-2">
                          <span
                            className="h-2"
                            style={{
                              width: `${Math.min(1, entry.durationSec / BAR_FULL_SEC) * 110}px`,
                              background: "var(--blue-live)",
                            }}
                          />
                          <span className="tnum whitespace-nowrap font-mono text-xs text-[var(--ink-muted)]">
                            {formatNumber(entry.durationSec, 1)} dtk
                          </span>
                        </span>
                      )}
                    </td>
                    <td className="w-[132px] py-3 text-right align-top sm:w-44 sm:align-middle">
                      {entry.pending ? (
                        <span className="stamp-pending">MENUNGGU ALAT</span>
                      ) : (
                        <span
                          className={`stamp whitespace-nowrap${
                            landing.current.has(entry.key) ? " stamp-land" : ""
                          }`}
                          onAnimationEnd={() => landing.current.delete(entry.key)}
                        >
                          SAH {formatClock(entry.ackedAt ?? entry.ts)}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {entries.length > 14 && (
              <p className="pt-4 font-mono text-xs text-[var(--ink-muted)]">
                menampilkan 14 catatan terbaru dari {entries.length}; terlama {formatDayClock(entries[entries.length - 1].ts)}
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
