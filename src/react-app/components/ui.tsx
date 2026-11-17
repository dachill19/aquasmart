import type { ReactNode } from "react";

export type Tone = "ok" | "warn" | "danger" | "info" | "neutral";

export function Tag({ tone = "neutral", children, dot }: { tone?: Tone; children: ReactNode; dot?: boolean }) {
  return (
    <span className="tag" data-tone={tone === "neutral" ? undefined : tone}>
      {dot && <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

/** A presence dot; the ring only animates while the device is actually live. */
export function Beacon({ tone }: { tone: "ok" | "danger" | "idle" }) {
  const color = tone === "ok" ? "var(--ok)" : tone === "danger" ? "var(--danger)" : "var(--faint)";
  return (
    <span className="relative flex h-2 w-2" aria-hidden="true">
      {tone === "ok" && <span className="beacon absolute inset-0 rounded-full" style={{ background: color }} />}
      <span className="relative h-2 w-2 rounded-full" style={{ background: color }} />
    </span>
  );
}

export function Spinner({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ animation: "spin 0.8s linear infinite" }}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

/** Title on the left, what the reader should know about it on the right. No icon tile: the words are enough. */
export function CardHead({ title, meta, children }: { title: string; meta?: string; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
      <div className="flex min-w-0 items-baseline gap-3">
        <h2 className="text-[0.95rem] font-semibold tracking-tight">{title}</h2>
        {meta && <p className="truncate text-xs text-muted">{meta}</p>}
      </div>
      {children}
    </div>
  );
}
