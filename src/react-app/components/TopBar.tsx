import { Moon, Sun } from "lucide-react";
import { formatAge, formatClock } from "../lib/format";
import { Beacon } from "./ui";

export type Page = "akuarium" | "analitik";

type Props = {
  lastSeen: number | null;
  now: number;
  offline: boolean;
  theme: "light" | "dark";
  onToggleTheme: () => void;
  page: Page;
  onNavigate: (page: Page) => void;
  /** Replaces the single-device presence line, e.g. on the fleet-wide Analitik page. */
  presence?: string;
};

const TABS: Array<{ page: Page; label: string; href: string }> = [
  { page: "akuarium", label: "Akuarium", href: "/" },
  { page: "analitik", label: "Analitik", href: "/analitik" },
];

export function TopBar({ lastSeen, now, offline, theme, onToggleTheme, page, onNavigate, presence }: Props) {
  const never = lastSeen === null;
  const state = never ? "idle" : offline ? "danger" : "ok";
  const title = presence ?? (never ? "Belum pernah terhubung" : offline ? "Alat terputus" : "Alat terhubung");

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-[color-mix(in_oklab,var(--bg)_80%,transparent)] backdrop-blur-md">
      {/* Wraps on phones: the page tabs drop to a second row instead of pushing the bar off-screen. */}
      <div className="mx-auto flex min-h-14 max-w-[2200px] flex-wrap items-center justify-between gap-x-4 px-4 sm:px-6 xl:px-8">
        <a href="/" className="flex items-center gap-2.5" aria-label="AQUASMART, ke atas">
          <img src="/logo-mark.png" alt="" width={30} height={30} className="h-[30px] w-[30px] object-contain" />
          <span className="text-[1.05rem] font-bold leading-none tracking-[0.03em] max-sm:hidden">
            AQUA<span className="text-accent">SMART</span>
          </span>
        </a>

        <nav aria-label="Halaman" className="flex gap-1 max-sm:order-last max-sm:w-full max-sm:pb-2.5 sm:mr-auto">
          {TABS.map((t) => (
            <a
              key={t.page}
              href={t.href}
              aria-current={t.page === page ? "page" : undefined}
              onClick={(e) => {
                // A plain link still works for new tabs and middle-click; a normal click stays in the app.
                if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
                e.preventDefault();
                onNavigate(t.page);
              }}
              className="rounded-[0.5rem] px-2.5 py-1.5 text-[0.82rem] font-medium text-muted transition-colors hover:text-fg aria-[current=page]:bg-raised aria-[current=page]:text-fg"
            >
              {t.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5" role="status">
            <Beacon tone={state} />
            <p className="tnum whitespace-nowrap text-[0.8rem] leading-none">
              <span className="font-semibold">{title}</span>
              {!never && !presence && (
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
