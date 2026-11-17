import type { ReactNode } from "react";

export type Tone = "ok" | "warn" | "danger" | "info" | "neutral";

export function Chip({ tone = "neutral", children, dot }: { tone?: Tone; children: ReactNode; dot?: boolean }) {
  return (
    <span className="chip" data-tone={tone === "neutral" ? undefined : tone}>
      {dot && <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

/** A pulsing presence dot; the ring only animates while the device is actually live. */
export function Beacon({ tone }: { tone: "ok" | "danger" | "idle" }) {
  const color = tone === "ok" ? "var(--ok)" : tone === "danger" ? "var(--danger)" : "var(--faint)";
  return (
    <span className="relative flex h-2.5 w-2.5" aria-hidden="true">
      {tone === "ok" && (
        <span className="beacon absolute inset-0 rounded-full" style={{ background: color }} />
      )}
      <span className="relative h-2.5 w-2.5 rounded-full" style={{ background: color }} />
    </span>
  );
}

export function Spinner({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      style={{ animation: "spin 0.8s linear infinite" }}
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function SectionTitle({
  icon,
  title,
  hint,
  right,
}: {
  icon: ReactNode;
  title: string;
  hint?: string;
  right?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
      <div className="flex items-center gap-3">
        <span
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-line-strong bg-raised text-accent"
          aria-hidden="true"
        >
          {icon}
        </span>
        <div>
          <h2 className="text-[0.95rem] font-semibold leading-tight tracking-tight">{title}</h2>
          {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
        </div>
      </div>
      {right}
    </div>
  );
}
