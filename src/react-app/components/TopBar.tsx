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

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-[color-mix(in_oklab,var(--bg)_80%,transparent)] backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-[2200px] items-center justify-between gap-4 px-4 sm:px-6 xl:px-8">
        <a href="/" className="flex items-center gap-2.5" aria-label="AQUASMART, ke atas">
          <img src="/logo-mark.png" alt="" width={30} height={30} className="h-[30px] w-[30px] object-contain" />
          <span className="text-[1.05rem] font-bold leading-none tracking-[0.03em]">
            AQUA<span className="text-accent">SMART</span>
          </span>
        </a>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5" role="status">
            <Beacon tone={state} />
            <p className="tnum whitespace-nowrap text-[0.8rem] leading-none">
              <span className="font-semibold">{title}</span>
              {!never && (
                <span className="hidden text-muted sm:inline">
                  {" "}
                  · {formatAge(now - lastSeen)} · {formatClock(lastSeen)}
                </span>
              )}
            </p>
          </div>

          <button
            type="button"
            onClick={onToggleTheme}
            aria-label={theme === "dark" ? "Ganti ke mode terang" : "Ganti ke mode gelap"}
            className="relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-[0.625rem] border border-line-strong text-muted transition-colors hover:bg-raised hover:text-fg"
          >
            <Sun
              size={16}
              className="absolute transition-all duration-500"
              style={{ transform: theme === "dark" ? "rotate(0) scale(1)" : "rotate(90deg) scale(0)", opacity: theme === "dark" ? 1 : 0 }}
            />
            <Moon
              size={16}
              className="absolute transition-all duration-500"
              style={{ transform: theme === "dark" ? "rotate(-90deg) scale(0)" : "rotate(0) scale(1)", opacity: theme === "dark" ? 0 : 1 }}
            />
          </button>
        </div>
      </div>
    </header>
  );
}
