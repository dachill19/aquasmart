import { Moon, Sun } from "lucide-react";
import { formatAge, formatClock } from "../lib/format";
import { OFFLINE_AFTER_MS } from "../lib/api";

type Props = {
  lastSeen: number | null;
  now: number;
  theme: "light" | "dark";
  onToggleTheme: () => void;
};

export function Header({ lastSeen, now, theme, onToggleTheme }: Props) {
  const age = lastSeen === null ? null : now - lastSeen;
  const offline = age === null || age > OFFLINE_AFTER_MS;

  return (
    <header className="border-b-2 border-[var(--blue)] bg-[var(--panel)]">
      <div className="mx-auto flex max-w-[1680px] flex-wrap items-end justify-between gap-x-6 gap-y-4 px-6 py-5 sm:px-10">
        <div className="flex min-w-0 flex-1 basis-full items-center gap-3 sm:basis-auto sm:gap-4">
          <img
            src="/logo-aquasmart.png"
            alt=""
            width={48}
            height={48}
            className="h-10 w-10 shrink-0 object-contain sm:h-12 sm:w-12"
          />
          <div className="min-w-0">
            <h1 className="text-lg font-bold tracking-[0.22em] sm:text-2xl sm:tracking-[0.3em]">
              AQUASMART
            </h1>
            <p className="label mt-1 tracking-[0.12em] sm:tracking-[0.2em]">
              Kartu kendali akuarium &mdash; unit 01
            </p>
          </div>
        </div>

        <div className="flex w-full items-end justify-between gap-4 sm:w-auto sm:gap-6">
          <div className="sm:text-right">
            <p className="label">Terakhir melapor</p>
            <p
              className="tnum mt-1 font-mono text-base font-medium sm:text-lg"
              style={{ color: offline ? "var(--stamp)" : "var(--ink)" }}
            >
              {age === null ? "belum pernah" : formatAge(age)}
            </p>
            {lastSeen !== null && (
              <p className="tnum mt-0.5 font-mono text-xs text-[var(--ink-muted)]">
                pukul {formatClock(lastSeen)}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={onToggleTheme}
            aria-label={theme === "dark" ? "Ganti ke mode terang" : "Ganti ke mode gelap"}
            className="flex h-11 w-11 items-center justify-center border border-[var(--rule)] text-[var(--ink-muted)] transition-colors hover:border-[var(--blue-live)] hover:text-[var(--ink)]"
          >
            {theme === "dark" ? <Sun size={18} strokeWidth={2} /> : <Moon size={18} strokeWidth={2} />}
          </button>
        </div>
      </div>
    </header>
  );
}
