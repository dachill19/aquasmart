import { Moon, Sun } from "lucide-react";
import { formatAge, formatClock } from "../lib/format";
import { Beacon } from "./ui";

type Props = {
  lastSeen: number | null;
  now: number;
  offline: boolean;
  theme: "light" | "dark";
  onToggleTheme: () => void;
};

export function TopBar({ lastSeen, now, offline, theme, onToggleTheme }: Props) {
  const never = lastSeen === null;
  const state = never ? "idle" : offline ? "danger" : "ok";
  const title = never ? "Belum pernah terhubung" : offline ? "Alat terputus" : "Alat terhubung";
  const detail = never ? "menunggu laporan pertama" : `melapor ${formatAge(now - lastSeen)}`;

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-[color-mix(in_oklab,var(--bg)_72%,transparent)] backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[1360px] items-center justify-between gap-4 px-4 sm:px-8">
        <a href="/" className="flex items-center gap-3" aria-label="AQUASMART, ke atas">
          <img src="/logo-mark.png" alt="" width={36} height={36} className="h-9 w-9 object-contain" />
          <span className="text-[1.15rem] font-bold leading-none tracking-[0.04em]">
            AQUA<span className="text-accent">SMART</span>
          </span>
        </a>

        <div className="flex items-center gap-2 sm:gap-3">
          <div
            className="flex items-center gap-3 rounded-full border border-line-strong bg-raised py-2 pl-3.5 pr-4"
            role="status"
          >
            <Beacon tone={state} />
            <div className="leading-none">
              <p className="whitespace-nowrap text-[0.8rem] font-semibold">{title}</p>
              <p className="tnum mt-1 hidden text-[0.7rem] text-muted sm:block">
                {detail}
                {!never && <span className="text-faint"> · {formatClock(lastSeen)}</span>}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onToggleTheme}
            aria-label={theme === "dark" ? "Ganti ke mode terang" : "Ganti ke mode gelap"}
            className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border border-line-strong bg-raised text-muted transition-colors hover:border-accent hover:text-fg"
          >
            <Sun
              size={17}
              className="absolute transition-all duration-500"
              style={{ transform: theme === "dark" ? "rotate(0) scale(1)" : "rotate(90deg) scale(0)", opacity: theme === "dark" ? 1 : 0 }}
            />
            <Moon
              size={17}
              className="absolute transition-all duration-500"
              style={{ transform: theme === "dark" ? "rotate(-90deg) scale(0)" : "rotate(0) scale(1)", opacity: theme === "dark" ? 0 : 1 }}
            />
          </button>
        </div>
      </div>
    </header>
  );
}
