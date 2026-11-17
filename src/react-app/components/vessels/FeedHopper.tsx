import { useId } from "react";

type Props = {
  /** 0–100, or null when the device has never reported. */
  level: number | null;
  threshold: number;
  /** Distance from the sensor to the feed surface, in millimetres. */
  distanceMm: number | null;
  stale: boolean;
};

const W = 360;
const H = 356;
const BODY = { x: 96, y: 74, w: 168, h: 214 };
const INNER = { x: 100, y: 78, w: 160, h: 206 };
// Resolution is about one step in five: the sensor's full scale is 1.5 cm of travel.
const STEP = 20;

const yAt = (p: number) => INNER.y + INNER.h * (1 - Math.min(100, Math.max(0, p)) / 100);

/** Deterministic pellet scatter, so the fill is stable between renders. */
const PELLETS = Array.from({ length: 150 }, (_, i) => {
  const a = Math.sin(i * 12.9898) * 43758.5453;
  const b = Math.sin(i * 78.233) * 24634.6345;
  const c = Math.sin(i * 39.346) * 11923.771;
  const frac = (n: number) => n - Math.floor(n);
  return {
    x: INNER.x + 6 + frac(a) * (INNER.w - 12),
    y: INNER.y + 4 + frac(b) * (INNER.h - 8),
    r: 2.4 + frac(c) * 1.8,
    tone: frac(a * b) > 0.55 ? 0 : frac(a * c) > 0.5 ? 1 : 2,
  };
});
const PELLET_FILL = ["#f5a524", "#e8861a", "#ffc65a"];

export function FeedHopper({ level, threshold, distanceMm, stale }: Props) {
  const uid = useId().replace(/:/g, "");
  const known = level !== null;
  const top = yAt(known ? level : 0);
  const critical = known && level < threshold;
  const tone = critical ? "var(--danger)" : "var(--feed)";
  const slide = "transform 1.4s cubic-bezier(0.22, 1, 0.36, 1)";
  const sensorY = 30;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className={`h-auto w-full ${stale ? "is-stale" : ""}`}
      style={{ filter: stale ? "saturate(0.3) brightness(0.9)" : undefined, transition: "filter 600ms" }}
      role="img"
      aria-label={
        known
          ? `Wadah pakan terisi sekitar ${Math.round(level)} persen. Ambang peringatan ${threshold} persen. Pembacaan bergerak dalam langkah sekitar ${STEP} persen.`
          : "Wadah pakan, belum ada pembacaan dari alat."
      }
    >
      <defs>
        <clipPath id={`${uid}-clip`}>
          <rect x={INNER.x} y={INNER.y} width={INNER.w} height={INNER.h} rx="10" />
        </clipPath>
        <linearGradient id={`${uid}-heap`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffb84a" stopOpacity="0.5" />
          <stop offset="1" stopColor="#b8620a" stopOpacity="0.72" />
        </linearGradient>
        <linearGradient id={`${uid}-shine`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.3" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`${uid}-beam`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--accent)" stopOpacity="0.55" />
          <stop offset="1" stopColor="var(--accent)" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Ultrasonic sensor on the lid, with its two transducers */}
      <g>
        <rect x={W / 2 - 52} y={sensorY - 22} width="104" height="30" rx="9" fill="var(--pipe)" />
        <rect x={W / 2 - 52} y={sensorY - 22} width="104" height="30" rx="9" fill="none" stroke="var(--line-strong)" />
        {[-26, 26].map((dx) => (
          <g key={dx}>
            <circle cx={W / 2 + dx} cy={sensorY - 7} r="9.5" fill="var(--pipe-inner)" stroke="var(--line-strong)" />
            <circle cx={W / 2 + dx} cy={sensorY - 7} r="4.2" fill="none" stroke="var(--accent)" strokeWidth="1.4" opacity="0.9" />
          </g>
        ))}
        <rect x={W / 2 - 12} y={sensorY - 11} width="24" height="8" rx="3" fill="var(--raised)" />
        <rect x={BODY.x + 12} y={sensorY + 6} width={BODY.w - 24} height="10" rx="3" fill="var(--pipe)" />
      </g>

      {/* Sensor beam to the surface */}
      {known && (
        <g>
          <path
            d={`M${W / 2 - 26},${sensorY + 4} L${W / 2 - 26 - 16},${top} L${W / 2 + 26 + 16},${top} L${W / 2 + 26},${sensorY + 4}Z`}
            fill={`url(#${uid}-beam)`}
            opacity="0.35"
          />
          <line
            x1={W / 2}
            x2={W / 2}
            y1={sensorY + 6}
            y2={top}
            stroke="var(--accent)"
            strokeWidth="1.3"
            strokeDasharray="3 5"
            className="vessel-stream"
            opacity="0.9"
          />
        </g>
      )}

      {/* Hopper glass */}
      <path
        d={`M${BODY.x},${BODY.y} H${BODY.x + BODY.w} V${BODY.y + BODY.h} L${BODY.x + BODY.w - 34},${BODY.y + BODY.h + 34} H${BODY.x + 34} L${BODY.x},${BODY.y + BODY.h}Z`}
        fill="var(--glass)"
      />

      {known ? (
        <g clipPath={`url(#${uid}-clip)`}>
          <g style={{ transform: `translateY(${top - INNER.y}px)`, transition: slide }}>
            <rect x={INNER.x} y={INNER.y} width={INNER.w} height={INNER.h + 60} fill={`url(#${uid}-heap)`} />
            {PELLETS.map((p, i) => (
              <circle key={i} cx={p.x} cy={p.y} r={p.r} fill={PELLET_FILL[p.tone]} opacity={0.92 - (p.y - INNER.y) / 900} />
            ))}
            {/* The surface: slightly heaped, because pellets are never flat. */}
            <path
              d={`M${INNER.x},${INNER.y + 5} Q${INNER.x + INNER.w * 0.3},${INNER.y - 4} ${INNER.x + INNER.w * 0.5},${INNER.y - 1} T${INNER.x + INNER.w},${INNER.y + 5}`}
              fill="none"
              stroke="#ffd98f"
              strokeOpacity="0.75"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </g>
        </g>
      ) : (
        <rect
          x={INNER.x + 8}
          y={INNER.y + 8}
          width={INNER.w - 16}
          height={INNER.h - 16}
          rx="8"
          fill="none"
          stroke="var(--line-strong)"
          strokeDasharray="5 7"
        />
      )}
      {!known && (
        <text x={W / 2} y={INNER.y + INNER.h / 2 + 4} textAnchor="middle" fontSize="12.5" fill="var(--muted)">
          Menunggu laporan alat
        </text>
      )}

      <rect x={INNER.x + 10} y={INNER.y + 12} width="9" height={INNER.h * 0.6} rx="4.5" fill={`url(#${uid}-shine)`} opacity="0.7" />
      <path
        d={`M${BODY.x},${BODY.y} H${BODY.x + BODY.w} V${BODY.y + BODY.h} L${BODY.x + BODY.w - 34},${BODY.y + BODY.h + 34} H${BODY.x + 34} L${BODY.x},${BODY.y + BODY.h}Z`}
        fill="none"
        stroke="var(--glass-edge)"
        strokeWidth="2"
        strokeLinejoin="round"
      />

      {/* Servo gate at the outlet */}
      <g>
        <rect x={BODY.x + 34} y={BODY.y + BODY.h + 32} width={BODY.w - 68} height="12" rx="5" fill="var(--pipe)" />
        <rect x={BODY.x + 34} y={BODY.y + BODY.h + 32} width={BODY.w - 68} height="12" rx="5" fill="none" stroke="var(--line-strong)" />
        <rect x={W / 2 + 18} y={BODY.y + BODY.h + 40} width="46" height="26" rx="7" fill="var(--pipe)" stroke="var(--line-strong)" />
        <circle cx={W / 2 + 41} cy={BODY.y + BODY.h + 53} r="5" fill="var(--pipe-inner)" stroke="var(--line-strong)" />
        <text x={W / 2 - 22} y={BODY.y + BODY.h + 68} fontSize="10" textAnchor="end" fontFamily="var(--font-mono)" fill="var(--faint)">
          servo
        </text>
      </g>

      {/* Quantised scale: five bands, because that is all the sensor can resolve. */}
      <g fontFamily="var(--font-mono)" fontSize="10" fill="var(--faint)">
        {[0, 20, 40, 60, 80, 100].map((p) => (
          <g key={p}>
            <line x1={BODY.x - 16} x2={BODY.x - 6} y1={yAt(p)} y2={yAt(p)} stroke="var(--muted)" strokeWidth="1.3" />
            <text x={BODY.x - 22} y={yAt(p) + 3.5} textAnchor="end">
              {p}
            </text>
          </g>
        ))}
        {[10, 30, 50, 70, 90].map((p) => (
          <line key={p} x1={BODY.x - 11} x2={BODY.x - 6} y1={yAt(p)} y2={yAt(p)} stroke="var(--line-strong)" />
        ))}
      </g>

      {/* Threshold */}
      <g>
        <line
          x1={BODY.x}
          x2={BODY.x + BODY.w + 6}
          y1={yAt(threshold)}
          y2={yAt(threshold)}
          stroke={critical ? "var(--danger)" : "var(--warn)"}
          strokeWidth="1.4"
          strokeDasharray="5 4"
        />
        <text
          x={BODY.x + BODY.w + 12}
          y={yAt(threshold) + 3.5}
          fontSize="10.5"
          fontWeight="600"
          fontFamily="var(--font-mono)"
          fill={critical ? "var(--danger)" : "var(--warn)"}
        >
          ambang {threshold}%
        </text>
      </g>

      {/* Level thumb */}
      {known && (
        <g style={{ transform: `translateY(${top}px)`, transition: slide }}>
          <g transform={`translate(${BODY.x - 4} 0)`}>
            <path d="M0,0 L-8,-9 L-44,-9 L-44,9 L-8,9Z" fill={tone} />
            <text x="-13" y="4" textAnchor="end" fontSize="11.5" fontWeight="700" fontFamily="var(--font-mono)" fill={critical ? "#fff" : "#2a1700"}>
              {Math.round(level)}%
            </text>
          </g>
        </g>
      )}

      {distanceMm !== null && known && (
        <g fontFamily="var(--font-mono)" fontSize="10.5" fill="var(--accent)">
          <line x1={BODY.x + BODY.w + 20} x2={BODY.x + BODY.w + 20} y1={sensorY + 6} y2={top} stroke="var(--accent)" strokeWidth="1" opacity="0.6" />
          <line x1={BODY.x + BODY.w + 16} x2={BODY.x + BODY.w + 24} y1={sensorY + 6} y2={sensorY + 6} stroke="var(--accent)" opacity="0.6" />
          <line x1={BODY.x + BODY.w + 16} x2={BODY.x + BODY.w + 24} y1={top} y2={top} stroke="var(--accent)" opacity="0.6" />
          <text x={BODY.x + BODY.w + 28} y={(sensorY + 6 + top) / 2 + 3.5} fontWeight="600">
            {Math.round(distanceMm)} mm
          </text>
        </g>
      )}
    </svg>
  );
}
