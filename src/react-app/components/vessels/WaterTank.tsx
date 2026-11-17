import { useId } from "react";

type Props = {
  /** 0–100, or null when the device has never reported. */
  level: number | null;
  /** Pump switches on below this level. */
  threshold: number;
  /** Pump stops filling at this level. */
  target: number;
  pumpOn: boolean;
  locked: boolean;
  /** A device that has gone quiet: the tank freezes and desaturates. */
  stale: boolean;
};

const W = 360;
const H = 356;
// Outer glass and the inner cavity the water lives in.
const TANK = { x: 58, y: 30, w: 216, h: 300, r: 28 };
const IN = { x: 62, y: 34, w: 208, h: 292, r: 24 };
const PERIOD = 120;
const SEGMENTS = 10;
const AMP = 5.5;

/** y coordinate of a percentage on the shared ruler, water surface and threshold lines. */
const yAt = (p: number) => IN.y + IN.h * (1 - Math.min(100, Math.max(0, p)) / 100);

/** A seamless sine drawn with chained quadratics; `t` reflects the control point each time. */
function wavePath(amp: number): { crest: string; fill: string } {
  const half = PERIOD / 2;
  let crest = `M0,0 q${half / 2},${-amp * 2} ${half},0`;
  for (let i = 1; i < SEGMENTS; i++) crest += ` t${half},0`;
  const width = half * SEGMENTS;
  return { crest, fill: `${crest} L${width},420 L0,420 Z` };
}

const FRONT = wavePath(AMP);
const BACK = wavePath(AMP * 1.25);

const TICKS = Array.from({ length: 21 }, (_, i) => i * 5);

export function WaterTank({ level, threshold, target, pumpOn, locked, stale }: Props) {
  const uid = useId().replace(/:/g, "");
  const known = level !== null;
  const top = yAt(known ? level : 0);
  const critical = known && level < threshold;
  const depth = IN.y + IN.h - top;
  const tone = critical ? "var(--danger)" : "var(--accent)";
  const nozzle = { x: 248, y: 62 };
  const streaming = pumpOn && known && top > nozzle.y + 8;
  const slide = "transform 1.4s cubic-bezier(0.22, 1, 0.36, 1)";

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className={`h-auto w-full ${stale ? "is-stale" : ""}`}
      style={{ filter: stale ? "saturate(0.3) brightness(0.9)" : undefined, transition: "filter 600ms" }}
      role="img"
      aria-label={
        known
          ? `Tangki air terisi ${Math.round(level)} persen. Pompa menyala di bawah ${threshold} persen dan berhenti di ${target} persen.`
          : "Tangki air, belum ada pembacaan dari alat."
      }
    >
      <defs>
        <clipPath id={`${uid}-clip`}>
          <rect x={IN.x} y={IN.y} width={IN.w} height={IN.h} rx={IN.r} />
        </clipPath>
        <linearGradient id={`${uid}-water`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--water-hi)" stopOpacity="0.92" />
          <stop offset="1" stopColor="var(--water-lo)" stopOpacity="0.98" />
        </linearGradient>
        <linearGradient id={`${uid}-back`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--aqua)" stopOpacity="0.5" />
          <stop offset="1" stopColor="var(--water-hi)" stopOpacity="0.15" />
        </linearGradient>
        <linearGradient id={`${uid}-shine`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.34" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`${uid}-fish`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#ff6b57" />
          <stop offset="1" stopColor="#ffb057" />
        </linearGradient>
        <radialGradient id={`${uid}-caustic`} cx="0.5" cy="0" r="0.9">
          <stop offset="0" stopColor="#bfe6ff" stopOpacity="0.3" />
          <stop offset="1" stopColor="#bfe6ff" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Stand */}
      <rect x={TANK.x - 10} y={TANK.y + TANK.h - 2} width={TANK.w + 20} height={14} rx={7} fill="var(--pipe)" />
      <rect x={TANK.x - 10} y={TANK.y + TANK.h - 2} width={TANK.w + 20} height={14} rx={7} fill="none" stroke="var(--line-strong)" />

      {/* Glass body */}
      <rect x={TANK.x} y={TANK.y} width={TANK.w} height={TANK.h} rx={TANK.r} fill="var(--glass)" />

      {known ? (
        <g clipPath={`url(#${uid}-clip)`}>
          <g style={{ transform: `translateY(${top}px)`, transition: slide }}>
            <g transform={`translate(${IN.x - PERIOD - 40} 0)`}>
              <path d={BACK.fill} fill={`url(#${uid}-back)`} className="vessel-wave-back" />
            </g>
            <g transform={`translate(${IN.x - PERIOD} 0)`}>
              <path d={FRONT.fill} fill={`url(#${uid}-water)`} className="vessel-wave" />
              <path
                d={FRONT.crest}
                fill="none"
                stroke="#fff"
                strokeOpacity="0.55"
                strokeWidth="1.6"
                strokeLinecap="round"
                className="vessel-wave"
              />
            </g>
            <rect x={IN.x} y={AMP} width={IN.w} height={Math.min(120, depth)} fill={`url(#${uid}-caustic)`} />
          </g>

          {/* The betta: shown only when there is water deep enough to swim in. */}
          <g
            style={{
              transform: `translate(${IN.x + IN.w * 0.46}px, ${top + depth * 0.5}px)`,
              transition: slide,
              opacity: depth > 64 ? 1 : 0,
            }}
          >
            <g className="vessel-fish">
              <g className="vessel-fish-body">
                <path
                  d="M-13,0 C-24,-11 -34,-13 -36,-6 C-31,-2 -31,2 -36,6 C-34,13 -24,11 -13,0Z"
                  fill={`url(#${uid}-fish)`}
                  opacity="0.78"
                />
                <path d="M-6,-6 C-2,-15 8,-15 11,-6Z" fill="#ff7a5c" opacity="0.8" />
                <path d="M-14,0 C-8,-9.5 9,-9.5 17,0 C9,9.5 -8,9.5 -14,0Z" fill={`url(#${uid}-fish)`} />
                <path d="M-4,4 C0,10 6,10 8,5Z" fill="#ff7a5c" opacity="0.75" />
                <circle cx="9.5" cy="-1.6" r="1.7" fill="#2a0f12" />
                <circle cx="10" cy="-2.1" r="0.55" fill="#fff" />
              </g>
            </g>
          </g>

          {/* Turbulence under the inlet while the pump is running. */}
          {pumpOn &&
            [0, 1, 2, 3, 4].map((n) => (
              <circle
                key={n}
                className="vessel-bubble"
                cx={nozzle.x - 14 + n * 7.5}
                cy={top + 38 + (n % 2) * 12}
                r={1.6 + (n % 3) * 0.7}
                fill="#e6f5ff"
                fillOpacity="0.8"
                style={{ animationDelay: `${n * 0.45}s` }}
              />
            ))}
        </g>
      ) : (
        <g>
          <rect
            x={IN.x + 8}
            y={IN.y + 8}
            width={IN.w - 16}
            height={IN.h - 16}
            rx={IN.r - 6}
            fill="none"
            stroke="var(--line-strong)"
            strokeDasharray="5 7"
          />
          <text
            x={IN.x + IN.w / 2}
            y={IN.y + IN.h / 2 + 4}
            textAnchor="middle"
            fontSize="12.5"
            fill="var(--muted)"
            fontFamily="var(--font-sans)"
          >
            Menunggu laporan alat
          </text>
        </g>
      )}

      {/* Glass reflections and rim, above the water. */}
      <rect x={IN.x + 12} y={IN.y + 18} width={11} height={IN.h * 0.62} rx={5.5} fill={`url(#${uid}-shine)`} opacity="0.7" />
      <rect x={IN.x + 30} y={IN.y + 18} width={4} height={IN.h * 0.3} rx={2} fill={`url(#${uid}-shine)`} opacity="0.45" />
      <rect x={TANK.x} y={TANK.y} width={TANK.w} height={TANK.h} rx={TANK.r} fill="none" stroke="var(--glass-edge)" strokeWidth="2" />

      {/* Ruler: 0 to 100, the same scale the surface and both threshold lines use. */}
      <g fontFamily="var(--font-mono)" fontSize="10" fill="var(--faint)">
        {TICKS.map((p) => {
          const major = p % 25 === 0;
          return (
            <g key={p}>
              <line
                x1={TANK.x - 6 - (major ? 9 : 4)}
                x2={TANK.x - 6}
                y1={yAt(p)}
                y2={yAt(p)}
                stroke={major ? "var(--muted)" : "var(--line-strong)"}
                strokeWidth={major ? 1.4 : 1}
              />
              {major && (
                <text x={TANK.x - 24} y={yAt(p) + 3.5} textAnchor="end">
                  {p}
                </text>
              )}
            </g>
          );
        })}
      </g>

      {/* Threshold flags: a dashed line across the glass and its label outside. */}
      {[
        { value: threshold, label: "ambang", color: critical ? "var(--danger)" : "var(--warn)" },
        { value: target, label: "target", color: "var(--aqua)" },
      ].map((t) => (
        <g key={t.label}>
          <line
            x1={TANK.x}
            x2={TANK.x + TANK.w + 6}
            y1={yAt(t.value)}
            y2={yAt(t.value)}
            stroke={t.color}
            strokeWidth="1.4"
            strokeDasharray="5 4"
            opacity="0.9"
          />
          <text
            x={TANK.x + TANK.w + 12}
            y={yAt(t.value) + 3.5}
            fontSize="10.5"
            fontFamily="var(--font-mono)"
            fontWeight="600"
            fill={t.color}
          >
            {t.label} {t.value}%
          </text>
        </g>
      ))}

      {/* Live level thumb riding the ruler. */}
      {known && (
        <g style={{ transform: `translateY(${top}px)`, transition: slide }}>
          <g transform={`translate(${TANK.x - 4} 0)`}>
            <path d="M0,0 L-8,-9 L-44,-9 L-44,9 L-8,9Z" fill={tone} />
            <text
              x="-13"
              y="4"
              textAnchor="end"
              fontSize="11.5"
              fontWeight="700"
              fontFamily="var(--font-mono)"
              fill="#fff"
            >
              {Math.round(level)}%
            </text>
          </g>
        </g>
      )}

      {/* Inlet pipe */}
      <g>
        <path
          d={`M${W - 6},16 L${nozzle.x},16 L${nozzle.x},${nozzle.y}`}
          fill="none"
          stroke={locked ? "var(--danger)" : "var(--pipe)"}
          strokeOpacity={locked ? 0.55 : 1}
          strokeWidth="13"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d={`M${W - 6},16 L${nozzle.x},16 L${nozzle.x},${nozzle.y}`}
          fill="none"
          stroke="var(--pipe-inner)"
          strokeWidth="8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {pumpOn && (
          <path
            d={`M${W - 10},16 L${nozzle.x},16 L${nozzle.x},${nozzle.y - 2}`}
            fill="none"
            stroke="var(--aqua)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="5 17"
            className="vessel-stream"
          />
        )}
        {locked && (
          <g transform="translate(304 16)">
            <circle r="13" fill="var(--danger)" />
            <rect x="-5.5" y="-1.5" width="11" height="8.5" rx="2" fill="#fff" />
            <path d="M-3.4,-1.5 V-4 a3.4,3.4 0 0 1 6.8,0 V-1.5" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
          </g>
        )}
      </g>

      {streaming && (
        <g>
          <line
            x1={nozzle.x}
            x2={nozzle.x}
            y1={nozzle.y + 4}
            y2={top}
            stroke="var(--aqua)"
            strokeWidth="3.2"
            strokeLinecap="round"
            strokeDasharray="6 8"
            className="vessel-stream"
            opacity="0.95"
          />
          {[0, 0.8].map((d) => (
            <ellipse
              key={d}
              className="vessel-ripple"
              cx={nozzle.x}
              cy={top + 1}
              rx="14"
              ry="3.2"
              fill="none"
              stroke="#e6f5ff"
              strokeWidth="1.2"
              style={{ animationDelay: `${d}s` }}
            />
          ))}
        </g>
      )}
    </svg>
  );
}
