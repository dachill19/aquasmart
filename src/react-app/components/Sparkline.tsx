import { useId } from "react";

type Props = {
  /** Values 0–100 in time order; nulls are skipped, not drawn as zero. */
  values: Array<number | null>;
  color: string;
  /** Feed stock moves in steps of about 20%, so its line is drawn stepped rather than smoothed. */
  step?: boolean;
  threshold: number;
  label: string;
};

const W = 320;
const H = 64;
const PAD = 4;

export function Sparkline({ values, color, step, threshold, label }: Props) {
  const uid = useId().replace(/:/g, "");
  const pts = values.filter((v): v is number => v !== null);
  if (pts.length < 2) return null;

  const x = (i: number) => (i / (pts.length - 1)) * W;
  const y = (v: number) => PAD + (H - PAD * 2) * (1 - Math.min(100, Math.max(0, v)) / 100);

  let line = `M${x(0)},${y(pts[0])}`;
  for (let i = 1; i < pts.length; i++) {
    line += step ? ` H${x(i)} V${y(pts[i])}` : ` L${x(i).toFixed(1)},${y(pts[i]).toFixed(1)}`;
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-14 w-full overflow-visible" role="img" aria-label={label}>
      <defs>
        <linearGradient id={`${uid}-f`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.22" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <line x1="0" x2={W} y1={y(threshold)} y2={y(threshold)} stroke="var(--danger)" strokeOpacity="0.55" strokeDasharray="3 4" vectorEffect="non-scaling-stroke" />
      <path d={`${line} V${H} H0 Z`} fill={`url(#${uid}-f)`} />
      <path d={line} fill="none" stroke={color} strokeWidth="1.75" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
