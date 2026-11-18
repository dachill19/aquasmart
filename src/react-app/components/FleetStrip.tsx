import { OFFLINE_AFTER_MS, type DeviceSummary } from "../lib/api";
import { formatAge } from "../lib/format";
import { Beacon, Tag } from "./ui";

type Props = {
  devices: DeviceSummary[];
  selected: number;
  now: number;
  onSelect: (id: number) => void;
};

function pumpText(d: DeviceSummary): string {
  if (d.terkunci) return "pompa terkunci";
  return d.pompa ? "pompa menyala" : "pompa mati";
}

/**
 * Every aquarium at a glance, and the switch between them. Choosing one points
 * every panel below at it. Simulated aquariums say so on their own card, so the
 * demo never passes for real hardware.
 */
export function FleetStrip({ devices, selected, now, onSelect }: Props) {
  if (devices.length < 2) return null;

  return (
    <nav aria-label="Daftar akuarium" className="-mx-4 mt-5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
      <ul className="grid min-w-max auto-cols-[minmax(15.5rem,1fr)] grid-flow-col gap-3 sm:min-w-0">
        {devices.map((d) => {
          const never = d.ts === null;
          const offline = never || now - d.ts! > OFFLINE_AFTER_MS;
          const active = d.id === selected;
          const quiet = offline ? "text-faint" : "text-fg";
          return (
            <li key={d.id}>
              <button
                type="button"
                onClick={() => onSelect(d.id)}
                aria-pressed={active}
                className="card flex w-full flex-col gap-2.5 px-4 py-3 text-left transition-colors hover:border-line-strong"
                style={active ? { borderColor: "var(--accent)", background: "var(--raised)" } : undefined}
              >
                <span className="flex items-center justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-2">
                    <Beacon tone={never ? "idle" : offline ? "danger" : "ok"} />
                    <span className="truncate text-[0.92rem] font-semibold tracking-tight">{d.name}</span>
                  </span>
                  {d.simulated ? <Tag>Simulasi</Tag> : <Tag tone="info">Alat asli</Tag>}
                </span>

                <span className="tnum flex items-baseline gap-4 font-mono text-[0.78rem]">
                  <span className={quiet}>
                    <span className="text-muted">air </span>
                    {d.level_air ?? "—"}
                    {d.level_air !== null && "%"}
                  </span>
                  <span className={quiet}>
                    <span className="text-muted">pakan </span>
                    {d.stok_pakan ?? "—"}
                    {d.stok_pakan !== null && "%"}
                  </span>
                </span>

                <span className="text-xs text-muted">
                  {never
                    ? "belum pernah melapor"
                    : offline
                      ? `terputus · ${formatAge(now - d.ts!)}`
                      : pumpText(d)}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
